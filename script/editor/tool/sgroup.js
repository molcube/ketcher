var HoverHelper = require('./helper/hover');
var LassoHelper = require('./helper/lasso');

var Action = require('../action');
var Struct = require('../../chem/struct');
var Set = require('../../util/set');

var searchMaps = ['atoms', 'bonds', 'sgroups', 'sgroupData'];

function SGroupTool(editor, type) {
	if (!(this instanceof SGroupTool)) {
		if (!editor.selection() || !editor.selection().atoms)
			return new SGroupTool(editor, type);

		// TODO: handle case when it's a sgroup already
		propsDialog(editor, null, type);
		editor.selection(null);
		return null;
	}

	this.editor = editor;
	this.type = type;

	this.hoverHelper = new HoverHelper(this);
	this.lassoHelper = new LassoHelper(1, editor);
	this.editor.selection(null);
}

SGroupTool.prototype.mousedown = function (event) {
	var ci = this.editor.findItem(event, searchMaps);
	if (!ci) //  ci.type == 'Canvas'
		this.lassoHelper.begin(event);
};

SGroupTool.prototype.mousemove = function (event) {
	if (this.lassoHelper.running())
		this.editor.selection(this.lassoHelper.addPoint(event));
	else
		this.hoverHelper.hover(this.editor.findItem(event, searchMaps));
};

SGroupTool.prototype.mouseup = function (event) {
	var id = null; // id of an existing group, if we're editing one
	var selection = null; // atoms to include in a newly created group
	if (this.lassoHelper.running()) { // TODO it catches more events than needed, to be re-factored
		selection = this.lassoHelper.end(event);
	} else {
		var ci = this.editor.findItem(event, searchMaps);
		if (!ci) // ci.type == 'Canvas'
			return;
		this.hoverHelper.hover(null);

		if (ci.map == 'atoms') {
			// if we click the SGroup tool on a single atom or bond, make a group out of those
			selection = { atoms: [ci.id] };
		} else if (ci.map == 'bonds') {
			var bond = this.editor.render.ctab.bonds.get(ci.id);
			selection = { atoms: [bond.b.begin, bond.b.end] };
		} else if (ci.map == 'sgroups') {
			id = ci.id;
		} else {
			return;
		}
	}

	// TODO: handle click on an existing group?
	if (id != null || (selection && selection.atoms))
		propsDialog(this.editor, id, this.type);
};

function propsDialog(editor, id, defaultType) {
	var restruct = editor.render.ctab;
	var struct = restruct.molecule;
	var atoms = editor.selection() && editor.selection().atoms;
	var sg = (id != null) && struct.sgroups.get(id);
	var type = sg ? sg.type : defaultType;
	var eventName = type == 'DAT' ? 'sdataEdit' : 'sgroupEdit';

	if (!atoms && !sg) {
		console.info('There is no selection or sgroup');
		return;
	}

	var res = editor.event[eventName].dispatch({
		type: type,
		attrs: sg ? sg.getAttrs() : {}
	});

	Promise.resolve(res).then(function (newSg) {
		// TODO: check before signal
		if (newSg.type != 'DAT' && // when data s-group separates
			checkOverlapping(struct, atoms || [])) {
			editor.event.message.dispatch({
				error: 'Partial S-group overlapping is not allowed.'
			});
		} else {
			var action = (id != null) && sg.getAttrs().context === newSg.attrs.context ?
				Action.fromSgroupType(restruct, id, newSg.type)
					.mergeWith(Action.fromSgroupAttrs(restruct, id, newSg.attrs)) :
				chooseAction(id, editor, newSg);

			editor.update(action);
		}
	}).catch(function (result) {
		console.info('rejected', result);
	});
}

function chooseAction(id, editor, newSg) {
	var restruct = editor.render.ctab;
	var struct = editor.render.ctab.molecule;
	var sg = (id != null) && struct.sgroups.get(id);
	var context = newSg.attrs.context;

	var action;
	switch (context) {
	case 'Fragment':
		action = onFragmentAction();
		break;
	case 'Single Bond':
		action = onSingleBondAction();
		break;
	case 'Atom':
		action = onAtomAction();
		break;
	case 'Group':
		action = onGroupAction();
		break;
	default:
		console.error('Invalid context');
		return new Action();
	}

	return (id === null || !action) ? action : action.mergeWith(Action.fromSgroupDeletion(restruct, id));

	function onGroupAction() {
		var atoms = sg.atoms || editor.selection().atoms;
		return sgroupAddAction(atoms);
	}

	function onFragmentAction() {
		var bonds = struct.bonds.ikeys();
		var atoms = struct.atoms.ikeys();
		editor.selection({ atoms: atoms, bonds: bonds });
		return sgroupAddAction(atoms);
	}

	function onAtomAction() {
		var currSelection = editor.selection();

		if (currSelection === null) {
			console.error('There is no selection');
			return new Action();
		}

		var atoms = sg.atoms || currSelection.atoms;

		var bonds = currSelection.bonds
			.map(function (id) {
				return  {
					id: id,
					bond: restruct.bonds.get(id)
				};
			})
			.filter(
				function (obj) {
					return !atoms.includes(obj.bond.b.begin) ||
						   !atoms.includes(obj.bond.b.end);
				})
			.map(function (bond) { return bond.id; });

		editor.selection({ atoms: currSelection.atoms, bonds: bonds });

		return atoms.reduce(function (acc, atom) {
			return acc.mergeWith(sgroupAddAction([atom]));
		}, new Action());
	}

	function onSingleBondAction() {
		var currSelection = editor.selection();

		if (currSelection === null) {
			console.error('There is no selection');
			return;
		}

		if (sg && sg.atoms.length === 1 || !currSelection.bonds) {
			console.error('Cannot transform single atom to single bond');
			return;
		}

		var bonds = currSelection.bonds.map(function (id) { return restruct.bonds.get(id); });

		var atoms = bonds.reduce(function (acc, bond) {
			var lastAtom = acc[acc.length - 1];
			if (lastAtom !== bond.b.begin)
				acc.push(bond.b.begin);
			acc.push(bond.b.end);
			return acc;
		}, []);

		editor.selection({ atoms: atoms, bonds: currSelection.bonds });

		return bonds.reduce(function (acc, bond) {
			return acc.mergeWith(sgroupAddAction([bond.b.begin, bond.b.end]));
		}, new Action());
	}

	function sgroupAddAction(atoms) {
		return Action.fromSgroupAddition(restruct, newSg.type, atoms, newSg.attrs, struct.sgroups.newId());
	}
}

function checkOverlapping(struct, atoms) {
	var verified = {};
	var atomsHash = {};

	atoms.each(function (id) {
		atomsHash[id] = true;
	});

	return 0 <= atoms.findIndex(function (id) {
		var atom = struct.atoms.get(id);
		var sgroups = Set.list(atom.sgs);

		return 0 <= sgroups.findIndex(function (sid) {
			var sg = struct.sgroups.get(sid);
			if (sg.type == 'DAT' || sid in verified)
				return false;

			var sgAtoms = Struct.SGroup.getAtoms(struct, sg);

			if (sgAtoms.length < atoms.length) {
				if (0 <= sgAtoms.findIndex(function (aid) {
					return !(aid in atomsHash);
				}))
					return true;
			} else if (0 <= atoms.findIndex(function (aid) {
				return (sgAtoms.indexOf(aid) == -1);
			})) {
				return true;
			}
			return false;
		});
	});
}

module.exports = Object.assign(SGroupTool, {
	dialog: propsDialog
});
