import { useStore } from '../../store'
import BackgroundRenderer from '../backgrounds/BackgroundRenderer'
import DeviceFrame from '../devices/DeviceFrame'
import TextBox from '../text/TextBox'
import TitleBlock from '../text/TitleBlock'
import ImageOverlay from '../images/ImageOverlay'

export default function Scene() {
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])

  const sortedDevices = [...scene.devices]
    .filter((d) => d.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  const sortedTextBoxes = [...scene.textBoxes]
    .filter((t) => t.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  const sortedImages = [...scene.images]
    .filter((i) => i.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  const allElements = [
    ...sortedDevices.map((d) => ({ type: 'device' as const, zIndex: d.zIndex, data: d })),
    ...sortedTextBoxes.map((t) => ({ type: 'textbox' as const, zIndex: t.zIndex, data: t })),
    ...sortedImages.map((i) => ({ type: 'image' as const, zIndex: i.zIndex, data: i }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: scene.canvas.width,
        height: scene.canvas.height
      }}
    >
      <BackgroundRenderer background={scene.background} />

      {allElements.map((el) => {
        switch (el.type) {
          case 'device':
            return <DeviceFrame key={el.data.id} device={el.data} />
          case 'textbox':
            return <TextBox key={el.data.id} textBox={el.data} />
          case 'image':
            return <ImageOverlay key={el.data.id} image={el.data} />
        }
      })}

      <TitleBlock />
    </div>
  )
}
