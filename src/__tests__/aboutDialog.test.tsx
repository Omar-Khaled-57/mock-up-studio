import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AboutDialog from '../renderer/components/shared/AboutDialog'
import { resetStore } from './helpers'
import pkg from '../../package.json'

beforeEach(() => {
  resetStore()
  cleanup()
})

describe('AboutDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AboutDialog open={false} onClose={() => {}} />)
    expect(container.querySelector('[data-modal]')).toBeNull()
    expect(screen.queryByText('Mockup Studio')).toBeNull()
  })

  it('renders the app name, tagline and current version when open', () => {
    render(<AboutDialog open onClose={() => {}} />)
    expect(screen.getByText('Mockup Studio')).toBeTruthy()
    expect(screen.getByText('Desktop device mockup scene builder.')).toBeTruthy()
    expect(screen.getByText(`Version ${pkg.version}`)).toBeTruthy()
    expect(screen.getByText('Created by Omar Khaled')).toBeTruthy()
  })

  it('links the repository and portfolio and opens them in a new tab', () => {
    render(<AboutDialog open onClose={() => {}} />)

    const repo = screen.getByRole('link', { name: '@Omar-Khaled-57' })
    expect(repo).toHaveAttribute('href', 'https://github.com/Omar-Khaled-57/mock-up-studio')
    expect(repo).toHaveAttribute('target', '_blank')

    const portfolio = screen.getByRole('link', { name: 'omar-el-khouly.vercel.app' })
    expect(portfolio).toHaveAttribute('href', 'https://omar-el-khouly.vercel.app')
    expect(portfolio).toHaveAttribute('target', '_blank')
  })

  it('Close runs onClose', () => {
    const onClose = vi.fn()
    render(<AboutDialog open onClose={onClose} />)
    fireEvent.click(document.querySelector('[data-about-close]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
