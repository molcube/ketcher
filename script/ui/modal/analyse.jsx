import { h, Component, render } from 'preact';
/** @jsx h */

import Dialog from '../component/dialog';

function roundOff(str, round) {
	return str.replace(/[0-9]*\.[0-9]+/g, (str) => (
		(+str).toFixed(round)
	));
}

class Analyse extends Component {
	constructor() {
		super();
		this.state = {
			roundWeight: 3,
			roundMass: 3
		};
	}

	changeRound(name, value) {
		let newState = {};
		newState[name] = +value;
		this.setState(newState);
	}
	ignore(value,st) {
		if(value.keyCode == 37 ||  value.keyCode == 39 || value.keyCode == 36 || value.keyCode == 35) {
			console.log(st,value);
		} else {
			return false;
		}
	}

	selectContent(roundName) {
		let selectList = [];
		for (let i = 0; i < 8; i++) {
			selectList.push(i == this.state[roundName] ? <option value={i} selected>{i + ' decimal places'}</option> :
				<option value={i}>{i + ' decimal places'}</option>)
		}
		return (<select onChange={el => this.changeRound(roundName, el.target.value)}>
			{selectList}
		</select>)
	}

	render (props, state) {
		return (
			<Dialog caption="Calculated Values"
					name="analyse" params={this.props}
					buttons={["Close"]}>
				<ul>{[
					{ name: 'Chemical Formula', key: 'gross' },
					{ name: 'Molecular Weight', key: 'molecular-weight', round: 'roundWeight' },
					{ name: 'Exact Mass', key: 'monoisotopic-mass', round: 'roundMass' },
					{ name: 'Elemental Analysis', key: 'mass-composition' }
				].map(v => (
					<li>
						<label>{v.name}:</label>
						{v.round ?
							<input value={typeof props[v.key] == 'number' ? props[v.key].toFixed(state[v.round]) : roundOff(props[v.key], state[v.round]) } readonly/> :
							<input value={props[v.key]} onkeydown={ev => this.ignore(ev,'down')} onkeypress={ev => this.ignore(ev,'press')} onkeyup={ev => this.ignore(ev,'up')} focus/>}
						{v.round ? this.selectContent(v.round) : null}
					</li>
				))
				}</ul>
			</Dialog>
		);
	}
}


export default function dialog(params) {
	var overlay = $$('.overlay')[0];
	return render((
		<Analyse {...params}/>
	), overlay);
};
