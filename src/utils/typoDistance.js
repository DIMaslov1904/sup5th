// Bounded optimal string alignment (restricted Damerau–Levenshtein): adjacent
// transpositions cost one edit. A substring cannot be edited more than once.
// Only the diagonal band and three rows are needed; values above the limit
// are represented by limit + 1 instead of computing the exact distance.
export const typoDistance = (source, target, limit) => {
    if (source === target) return 0
    const left = Array.from(source), right = Array.from(target)
    const exceeded = limit + 1
    if (Math.abs(left.length - right.length) > limit) return exceeded
    if (!left.length || !right.length) return Math.min(exceeded, left.length + right.length)

    let beforePrevious = Array(right.length + 1).fill(exceeded)
    let previous = Array.from({ length: right.length + 1 }, (_, column) => Math.min(column, exceeded))
    let current = Array(right.length + 1).fill(exceeded)

    for (let row = 1; row <= left.length; row++) {
        const start = Math.max(1, row - limit), end = Math.min(right.length, row + limit)
        current[0] = Math.min(row, exceeded)
        if (start > 1) current[start - 1] = exceeded
        if (end < right.length) current[end + 1] = exceeded
        let minimum = current[0]

        for (let column = start; column <= end; column++) {
            let distance = Math.min(
                previous[column] + 1,
                current[column - 1] + 1,
                previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
            )
            if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
                distance = Math.min(distance, beforePrevious[column - 2] + 1)
            }
            current[column] = Math.min(distance, exceeded)
            minimum = Math.min(minimum, current[column])
        }
        if (minimum > limit) return exceeded
        const reusable = beforePrevious
        beforePrevious = previous
        previous = current
        current = reusable
    }
    return previous[right.length]
}
