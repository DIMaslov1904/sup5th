export const iconBackgroundFromPixels = pixels => {
    let brightness = 0, weight = 0
    for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255
        if (alpha < 0.06) continue
        brightness += (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) * alpha
        weight += alpha
    }
    return !weight || brightness / weight >= 186 ? 'transparent' : 'white'
}
