function getFileLink(fileKey) {
    return `${process.env.AWS_CF_DOMAIN_NAME}/${fileKey}`
}

module.exports = {
    getFileLink
}