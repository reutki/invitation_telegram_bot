# Church Event Registration Bot

This project is a Telegram bot for registering users for church events. It allows users to select their preferred language, input their personal information, choose an event date, and receive a QR code for their registration.

## Features

- User registration via Telegram
- Language selection (Russian or Romanian)
- Input for name, surname, and phone number
- Date selection from available dates in MongoDB
- QR code generation containing user information

## Project Structure

```
church-event-registration
├── src
│   ├── bot.js                     # Initializes the Telegram bot and handles commands
│   ├── controllers
│   │   └── registrationController.js # Manages user registration flow
│   ├── models
│   │   └── userModel.js           # Defines the User schema with Mongoose
│   ├── routes
│   │   └── registrationRoutes.js   # Defines routes for user registration
│   └── utils
│       └── qrCodeGenerator.js      # Generates QR codes for registered users
├── package.json                    # npm configuration file
├── .env                             # Environment variables (Telegram token, MongoDB URI)
├── .gitignore                       # Files and directories to ignore by Git
└── README.md                        # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd church-event-registration
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Telegram bot token and MongoDB connection string:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   MONGODB_URI=your_mongodb_connection_string
   ```

4. Start the bot:
   ```
   node src/bot.js
   ```

## Usage

- Start the registration process by sending the `/start` command in the Telegram chat.
- Follow the prompts to select your language, enter your personal information, and choose an event date.
- After successful registration, you will receive a QR code containing your registration details.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.