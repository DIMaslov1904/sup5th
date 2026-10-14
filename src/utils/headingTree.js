export const buildHeadingTree = rows => {
    const roots = [], stack = []
    for (const row of rows) {
        const node = { ...row, children: [] }
        while (stack.length && stack.at(-1).level >= node.level) stack.pop()
        const parent = stack.at(-1)
        ;(parent ? parent.children : roots).push(node)
        stack.push(node)
    }
    return roots
}
