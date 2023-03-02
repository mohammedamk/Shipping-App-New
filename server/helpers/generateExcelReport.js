const xlsx = require('xlsx')

module.exports = function generateReport(array) {
  const sheet = xlsx.utils.json_to_sheet(array)
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, sheet)
  return xlsx.write(wb, { type: 'buffer', bookType: 'csv' })
}
