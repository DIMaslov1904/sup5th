import assert from 'node:assert/strict'
import test from 'node:test'
import { closedPopupState, defaultPopupState, restorePopupState } from '../src/utils/popupState.js'

test('restores the selected project by its catalogue key and accepts a previous URL-based state', () => {
    const state = { view: 'projects', projectKey: 'panel:https://panel.example.com:42' }
    const closed = closedPopupState(state, 100)
    assert.equal(restorePopupState(closed, 101).projectKey, state.projectKey)
    assert.deepEqual(restorePopupState(closed, closed.expiresAt), defaultPopupState())
    assert.equal(restorePopupState({ view: 'projects', projectUrl: 'site.example.com', expiresAt: 150 }, 100).projectKey, 'site.example.com')
})
