import { render, screen } from '@testing-library/react'
import StartupError from './StartupError'

describe('StartupError', () => {
  it('renders the title and detail text', () => {
    render(<StartupError title="Inkwell failed to start" detail="window.api missing" />)
    // getByText throws if the element is absent, so these calls assert presence.
    expect(screen.getByText('Inkwell failed to start')).toBeTruthy()
    expect(screen.getByText('window.api missing')).toBeTruthy()
  })
})
