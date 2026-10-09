# 🧘‍♂️ ShangAI
> **Turn your camera into a personal AI coach and interactive workout rival.**

ShangAI is an AI-powered physical training platform that turns your webcam into a real-time movement coach. Whether you are practicing calming yoga postures, practicing shadow boxing combos, or executing taekwondo kicks, ShangAI checks your form, scores your accuracy, and lets you compete against AI or your friends in real time—no special wearables required.

---

## ✨ What Can You Do with ShangAI?

* 🧘 **Mindfulness & Yoga (Static Mode):** Hold postures while the AI checks your body alignment and gives you live audio-visual prompts to correct your pose.
* 🥊 **Shadow Boxing & Taekwondo (Dynamic Mode):** Execute punch and kick combinations while the AI measures your speed, accuracy, and form synchronization.
* 🤖 **Train with an AI Ghost Rival:** Practice side-by-side with a transparent virtual coach that demonstrates ideal movements.
* ⚔️ **Live P2P Competition:** Send a link to a friend and compete in real-time to see who executes routines with higher accuracy.
* 📊 **Smart Post-Workout Feedback:** Get an instant summary from an AI coach highlighting your score, strengths, and areas to improve.

---

## 🎮 How to Use

1. **Open the App:** Launch the website and grant camera permission.
2. **Choose Your Activity:** Select between **Yoga**, **Shadow Boxing**, or **Taekwondo**.
3. **Select Your Mode:** Train solo against the **AI Ghost Rival** or challenge a friend in **P2P Match**.
4. **Step Back:** Stand 2–3 meters away from your screen so your webcam can see your entire body (head to toe).
5. **Start Training:** Follow the movement cues on screen, watch for green (correct) or red (adjustment needed) indicators, and collect points!

---

## 🛠️ Built With

* **Frontend:** React.js, HTML5 Canvas, Web Speech API
* **Computer Vision:** MediaPipe Pose (Real-time 3D landmark tracking)
* **Real-Time Multiplayer:** WebSockets / WebRTC
* **Backend & AI Coach:** Python / FastAPI, Claude 3.5 Sonnet API

---

## 🚀 Quick Local Setup

### 1. Clone & Install Frontend
```bash
git clone [https://github.com/your-username/shangai.git](https://github.com/your-username/shangai.git)
cd shangai
npm install
npm start
