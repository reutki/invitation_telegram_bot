const QRCode = require('qrcode');

const generateQRCode = async (userData) => {
    const { name, surname, phoneNumber, registrationDate } = userData;
    const qrData = `Name: ${name}\nSurname: ${surname}\nPhone: ${phoneNumber}\nDate: ${registrationDate}`;
    
    try {
        const qrCode = await QRCode.toDataURL(qrData);
        return qrCode;
    } catch (error) {
        throw new Error('Error generating QR code: ' + error.message);
    }
};

module.exports = generateQRCode;