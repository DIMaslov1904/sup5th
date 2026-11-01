// Writes a value the way a user would: React/Vue controlled inputs listen to
// the native setter's input/change events, not to a direct `.value` assignment.
export const setInputValue = (input, value) => {
    const view = input.ownerDocument?.defaultView || globalThis
    Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}
