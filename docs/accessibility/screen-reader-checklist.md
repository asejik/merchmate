# Screen reader check (about 15 minutes, on a real phone)

The automated tests check structure, names, contrast, focus and keyboard behaviour. They cannot tell you
whether the app *sounds* right. Do this once on your phone, and again after large UI changes.

**Android:** Settings > Accessibility > TalkBack (or Voice Assistant on Samsung). Swipe right to move on, double-tap to activate.
**iPhone:** Settings > Accessibility > VoiceOver. Swipe right to move on, double-tap to activate.
Use the installed app or https://invoice-aso-oke.vercel.app/ in Chrome or Safari. Use demo data, not real clients.

Tick each when it sounds sensible and you could do the task without looking:

- [ ] **Opening the app:** it announces "Dashboard" (the page title) and you land at the top of the screen
- [ ] **Bottom bar:** five buttons are read as "Home", "Invoices", "New", "Clients", "Settings", and the current one as current
- [ ] **Changing screens:** after tapping a tab, the new screen's heading is read (not the old screen)
- [ ] **New invoice:** every field is read with its label ("Customer", "Invoice number", "Due date", "Price"...)
- [ ] **A mistake:** leave the client blank and tap Generate Invoice: the error is read, and focusing the field reads it again
- [ ] **Currency (NGN, USD...):** read as a group of choices, with the selected one stated
- [ ] **Invoice list:** each invoice card reads the client, number, status and amount in a sensible order
- [ ] **Actions menu (three dots):** opens with the first item read, swiping moves through the items, and closing it returns you to the three-dot button
- [ ] **Record payment:** the window is announced ("Record Payment"), you cannot swipe into the page behind it, and closing it returns you to the button
- [ ] **A confirmation (for example Void):** the question and both choices are read; "Void invoice" is clearly the risky one
- [ ] **Share window:** "Ready to Send", then the three ways to send
- [ ] **App Lock screen:** "MerchMate is locked", the PIN field is named, and a wrong PIN is announced without hunting for it
- [ ] **Backup reminder and the draft card on Home:** read as their own labelled sections

Write down anything confusing, and send it with the screen name. A short list is enough.
