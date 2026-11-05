const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`

export const encodeAuditCsv = rows => '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')
