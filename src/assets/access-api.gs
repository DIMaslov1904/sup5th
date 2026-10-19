const ACCESS_SHEET_NAME = 'Доступы к сайтам'
const SERVICES_SHEET_NAME = 'Корпоративные доступы'

const getData = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheetAccess = ss.getSheetByName(ACCESS_SHEET_NAME)
  if (!sheetAccess) throw new Error(`Лист '${ACCESS_SHEET_NAME}' не найден`)

  const sheetServices = ss.getSheetByName(SERVICES_SHEET_NAME)
  if (!sheetServices) throw new Error(`Лист '${SERVICES_SHEET_NAME}' не найден`)

  const res = { access: [], services: [] }
  const lastRowAccess = sheetAccess.getLastRow() - 1
  if (lastRowAccess > 0) res.access = sheetAccess.getRange(2, 1, lastRowAccess, 7).getValues()

  const lastRowServices = sheetServices.getLastRow() - 1
  if (lastRowServices > 0) res.services = sheetServices.getRange(2, 1, lastRowServices, 4).getValues()

  return res
}

const doGet = () => {
  try {
    const cache = CacheService.getScriptCache()
    const cached = cache.get('sheet_data')
    const result = cached ? JSON.parse(cached) : getData()
    if (!cached) cache.put('sheet_data', JSON.stringify(result), 120)

    return ContentService
      .createTextOutput(JSON.stringify({ result }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
