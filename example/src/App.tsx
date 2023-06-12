import 'ketcher-react/dist/index.css'

import { ButtonsConfig, Editor } from 'ketcher-react'
import { Ketcher, StructServiceProvider } from 'ketcher-core'
import { initiallyHidden } from './constants/buttons'
import { ErrorModal } from './ErrorModal'
import { useState } from 'react'

const getHiddenButtonsConfig = (btnArr: string[]): ButtonsConfig => {
  return btnArr.reduce((acc, button) => {
    if (button) acc[button] = { hidden: true }

    return acc
  }, {})
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StandaloneStructServiceProvider } = require('ketcher-standalone')
const structServiceProvider =
  new StandaloneStructServiceProvider() as StructServiceProvider

const App = () => {
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  return (
    <div className="ketcher-container">
      <Editor
        errorHandler={(message: string) => {
          setHasError(true)
          setErrorMessage(message.toString())
        }}
        buttons={getHiddenButtonsConfig(initiallyHidden)}
        staticResourcesUrl={''}
        structServiceProvider={structServiceProvider}
        onInit={(ketcher: Ketcher) => {
          ;(global as typeof globalThis & { ketcher: Ketcher }).ketcher =
            ketcher
          window.parent.postMessage(
            {
              eventType: 'init'
            },
            '*'
          )
        }}
      />
      {hasError && (
        <ErrorModal
          message={errorMessage}
          close={() => {
            setHasError(false)

            // Focus on editor after modal is closed
            const cliparea: HTMLElement | null =
              document.querySelector('.cliparea') || null
            cliparea?.focus()
          }}
        />
      )}
    </div>
  )
}

export default App
