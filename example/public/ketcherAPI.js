const KetcherAPI = (ketcherInstance) => {
  const selectElementsById = ({ atoms, bonds }) => {
    ketcherInstance.editor.selection({ atoms, bonds })
  }

  const cleatSelection = () => {
    ketcherInstance.editor.selection(null)
  }

  const highlightSelection = function (color) {
    const selection = ketcherInstance.editor.selection() || {}
    const { atoms, bonds } = selection
    ketcherInstance.editor.highlights.create({ atoms, bonds, color })

    const allHighlights = ketcherInstance.editor.render.ctab.molecule.highlights
    const lastHighlightID = Array.from(allHighlights.keys()).pop()
    const lastHighlight = allHighlights.get(lastHighlightID)

    return {
      lastHighlightID,
      lastHighlight
    }
  }

  return {
    showProteinChain: ({ atoms = [], bonds = [] }) => {
      selectElementsById({ atoms, bonds })
      highlightSelection('red')
      cleatSelection()
    }
  }
}
