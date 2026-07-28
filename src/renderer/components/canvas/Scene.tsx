import { useMemo, useState, useCallback } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import BackgroundRenderer from '../backgrounds/BackgroundRenderer'
import DeviceFrame from '../devices/DeviceFrame'
import TextBox from '../text/TextBox'
import TitleBlock from '../text/TitleBlock'
import ImageOverlay from '../images/ImageOverlay'
import Grid from './Grid'
import Guides from './Guides'
import WatermarkOverlay from './WatermarkOverlay'

interface ActiveGuides {
  verticalGuides: number[]
  horizontalGuides: number[]
}

export default function Scene() {
  const scene = useStore(safeScene)
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({ verticalGuides: [], horizontalGuides: [] })

  const handleGuidesChange = useCallback((guides: ActiveGuides) => {
    setActiveGuides(guides)
  }, [])

  const allElements = useMemo(() => {
    const sortedDevices = [...scene.devices]
      .filter((d) => d.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    const sortedTextBoxes = [...scene.textBoxes]
      .filter((t) => t.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    const sortedImages = [...scene.images]
      .filter((i) => i.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    return [
      ...sortedDevices.map((d) => ({ type: 'device' as const, zIndex: d.zIndex, data: d })),
      ...sortedTextBoxes.map((t) => ({ type: 'textbox' as const, zIndex: t.zIndex, data: t })),
      ...sortedImages.map((i) => ({ type: 'image' as const, zIndex: i.zIndex, data: i }))
    ].sort((a, b) => a.zIndex - b.zIndex)
  }, [scene.devices, scene.textBoxes, scene.images])

  return (
    <div
      data-scene-export
      className="relative overflow-hidden"
      style={{
        width: scene.canvas.width,
        height: scene.canvas.height
      }}
    >
      <BackgroundRenderer background={scene.background} />

      <Grid grid={scene.grid} canvasWidth={scene.canvas.width} canvasHeight={scene.canvas.height} />

      {scene.guides.map((g) => (
        <div
          key={g.id}
          className="absolute pointer-events-none"
          style={
            g.orientation === 'vertical'
              ? { left: g.position, top: 0, width: 0, height: scene.canvas.height, borderLeft: '1px dashed #f472b6' }
              : { left: 0, top: g.position, width: scene.canvas.width, height: 0, borderTop: '1px dashed #f472b6' }
          }
        />
      ))}

      <Guides
        verticalGuides={activeGuides.verticalGuides}
        horizontalGuides={activeGuides.horizontalGuides}
        canvasWidth={scene.canvas.width}
        canvasHeight={scene.canvas.height}
      />

      {allElements.map((el) => {
        switch (el.type) {
          case 'device':
            return <DeviceFrame key={el.data.id} device={el.data} onGuidesChange={handleGuidesChange} />
          case 'textbox':
            return <TextBox key={el.data.id} textBox={el.data} onGuidesChange={handleGuidesChange} />
          case 'image':
            return <ImageOverlay key={el.data.id} image={el.data} onGuidesChange={handleGuidesChange} />
        }
      })}

      <WatermarkOverlay />

      <TitleBlock />
    </div>
  )
}
