# 📲 NearShare

**NearShare** is a React Native-based Android/iOS application that enables real-time device discovery, peer-to-peer chatting, and file sharing over the same local network. Once two devices connect, a secure isolated communication area is created to exchange messages or share files seamlessly.

---

## 🚀 Features

- 📡 **Device Discovery** on the same Wi-Fi network
- 🔒 **Isolated Communication Channel** between two connected devices
- 💬 **Instant Messaging** support
- 📁 **File Sharing** (images, documents, etc.)
- 📱 Works on both **Android and iOS**

---

## 🛠️ Requirements

- Node.js (Recommended: v16+)
- npm or yarn
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- USB Debugging enabled (for physical device testing)
- Developer Mode enabled on your Android/iOS device

---

## 📦 Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/NearShare.git
cd NearShare
````

2. Install dependencies:

```bash
npm install
# or
yarn install
```

---

## 📱 Running on Android

### Prerequisites

* Ensure **USB Debugging** and **Developer Options** are enabled on your Android device.
* Connect your device via USB.
* Confirm the device is listed with:

```bash
adb devices
```

### Start the Metro bundler:

```bash
npm start
```

### Launch the app:

```bash
npm run android
```

**OR** if using a specific device ID:

```bash
npx react-native run-android --deviceId {your_device_id}
```

---

## 🍏 Running on iOS (macOS only)

> Requires Xcode and macOS.

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

---

## 🧪 Testing the App

1. Make sure both devices are connected to the same **Wi-Fi network**.
2. Launch the NearShare app on both devices.
3. Wait for automatic device discovery.
4. Select a device to initiate connection.
5. Start **chatting** and **sharing files** instantly.

---

## 📂 Folder Structure

```
NearShare/
├── android/
├── ios/
├── context/
├── fileSharing/
├── providers/
├── screens/
├── utils/
├── types/
├── App.tsx
├── package.json
└── README.md
```

---

## 🙌 Contributing

Contributions are welcome! Please fork the repo and submit a pull request.

---

## 📄 License

This project is licensed under the MIT License.
