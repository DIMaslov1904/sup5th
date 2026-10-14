export const createSeoSessionClient = port => {
    let nextId = 0
    const requests = new Map()
    const finish = (requestId, state = null) => {
        const request = requests.get(requestId)
        if (!request) return
        clearTimeout(request.timeout)
        requests.delete(requestId)
        request.resolve(state)
    }
    const receive = message => {
        if (message?.type !== 'seo:restore') return
        finish(message.requestId, message.state || null)
    }
    const dispose = () => {
        port.onMessage.removeListener(receive)
        for (const id of requests.keys()) finish(id)
    }
    port.onMessage.addListener(receive)
    return {
        load: context => new Promise(resolve => {
            const requestId = ++nextId
            requests.set(requestId, { resolve, timeout: setTimeout(() => finish(requestId), 5000) })
            try { port.postMessage({ type: 'seo:get', requestId, context }) }
            catch { finish(requestId) }
        }),
        save: (context, state) => {
            try { port.postMessage({ type: 'seo:save', context, state }) }
            catch { /* Окно уже закрыто; срок хранения задаёт background. */ }
        },
        dispose
    }
}
