# MerchMate: Smart Invoicing (PWA)

A modern, offline-first Progressive Web App (PWA) designed to help small businesses and freelancers manage clients, track payments, and generate professional PDF invoices instantly—even without an internet connection.

![App Screenshot](https://via.placeholder.com/800x400?text=App+Screenshot+Placeholder)

## 🚀 Live Demo
**[Insert your Vercel URL here]**

## ✨ Features

* **📱 Offline-First Architecture:** Built with **Dexie.js (IndexedDB)**, allowing full functionality (creating invoices, adding clients) without internet access. Data syncs locally.
* **📄 PDF Generation:** Generates professional A4 invoices instantly in the browser using `@react-pdf/renderer`.
* **🌍 Multi-Currency Support:** Seamlessly switch between **NGN (₦), USD ($), GBP (£), and EUR (€)**.
* **📊 Real-Time Dashboard:** Tracks "Cash Collected" vs. "Pending Balance" to give a clear view of financial health.
* **💬 Native WhatsApp Sharing:** Uses the Web Share API to attach PDF invoices directly to WhatsApp chats on mobile devices.
* **🔢 Smart Numbering:** Automatically detects the last invoice number and increments the next one (e.g., INV-001 → INV-002).
* **🎨 Glassmorphism UI:** A high-end, modern interface built with **Tailwind CSS v4** and **Framer Motion**.
* **💰 Payment Tracking:** Handles partial payments, deposits, and automatically updates invoice status (Pending, Partial, Paid).

## 🛠️ Tech Stack

* **Framework:** React 18 (Vite)
* **Styling:** Tailwind CSS v4
* **Database:** Dexie.js (IndexedDB wrapper)
* **PDF Engine:** @react-pdf/renderer
* **Icons:** Lucide React
* **Animations:** Framer Motion
* **Deployment:** Vercel

## ⚙️ Installation & Setup

Follow these steps to run the project locally.

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/merchmate.git
cd merchmate
2. Install Dependencies
Note: This project strictly uses React 18 to ensure compatibility with the PDF renderer.

Bash

npm install
3. Run Development Server
Bash

npm run dev
The app will open at http://localhost:5173.

4. Build for Production
Bash

npm run build
📱 How to Use (Mobile PWA)
Open the live link on your mobile browser (Chrome on Android / Safari on iOS).

Android: Tap the menu (3 dots) ➝ "Install App" or "Add to Home Screen".

iOS: Tap the Share button ➝ "Add to Home Screen".

Launch the app from your home screen. It will now work offline (Airplane Mode).

🐛 Troubleshooting
PDF Generation Fails in Production
This project uses Node Polyfills (buffer, process) to allow the PDF engine to run in the browser.

If you encounter Buffer is not defined, ensure src/types/window.d.ts exists.

If you see __SECRET_INTERNALS... error, ensure you are running React 18, not React 19.

React Version Conflict
If dependencies try to install React 19, run:

Bash

rm -rf node_modules package-lock.json
npm install
The package.json contains an overrides section to enforce React 18.

🤝 Contributing
Fork the repository.

Create a feature branch (git checkout -b feature/AmazingFeature).

Commit your changes (git commit -m 'Add some AmazingFeature').

Push to the branch (git push origin feature/AmazingFeature).

Open a Pull Request.

📄 License
Distributed under the MIT License. See LICENSE for more information.

Built with ❤️ for small businesses.