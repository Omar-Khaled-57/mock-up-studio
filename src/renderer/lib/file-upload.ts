/**
 * Opens a native file picker for a single image and delivers the result as a
 * data URL. Used by the Select tool's double-click upload for device screens.
 */
export function pickImageFile(onDataUrl: (dataUrl: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }
  input.click()
}
