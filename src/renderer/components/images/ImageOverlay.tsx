import { useMemo } from 'react'
import { ImageOverlay as ImageOverlayType } from '@shared/types'
import ElementFacade from '../../elements/ElementFacade'
import { buildEffectsFilter } from '../../lib/effects'
import { useInstanceMirror } from '../../lib/component-utils'

interface Props {
  image: ImageOverlayType
}

export default function ImageOverlay({ image: raw }: Props) {
  const image = useInstanceMirror(raw)
  const combinedFilter = useMemo(() => {
    const filters: string[] = []
    if (image.glow.length > 0) {
      for (const g of image.glow) {
        if (!g.enabled) continue
        filters.push(`drop-shadow(0 0 ${g.blur}px ${g.color})`)
      }
    }
    if (image.shadow.length > 0) {
      for (const s of image.shadow) {
        if (!s.enabled) continue
        filters.push(`drop-shadow(${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color})`)
      }
    }
    if (image.blur) filters.push(`blur(${image.blur}px)`)
    const effectsFilter = buildEffectsFilter(image.effects)
    if (effectsFilter) filters.push(effectsFilter)
    return filters.join(' ')
  }, [image.shadow, image.glow, image.blur, image.effects])

  return (
    <ElementFacade
      id={image.id}
      kind="image"
      locked={image.locked}
      style={{
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        transform: `rotate(${image.rotation}deg) scaleX(${image.flipX ? -1 : 1}) scaleY(${image.flipY ? -1 : 1})`,
        transformOrigin: 'center center',
        zIndex: image.zIndex,
        cursor: image.locked ? 'default' : 'move',
        opacity: image.opacity / 100,
        borderRadius: image.borderRadius,
        overflow: 'hidden',
        filter: combinedFilter
      }}
    >
      <img
        src={image.src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          display: 'block',
          pointerEvents: 'none',
          mixBlendMode: image.blendMode
        }}
        draggable={false}
      />
    </ElementFacade>
  )
}
