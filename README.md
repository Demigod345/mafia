# **Cali Mafia – Public Frontend and Starknet Game Logic**

Welcome to the repository for the **public frontend** and the **main Starknet contract** for *Cali Mafia*, a privacy-centric on-chain version of the classic Mafia game. This project was built during the **Calimero x Starknet Hackathon** and introduces a revolutionary paradigm for decentralized strategy games.

---

## **Overview**

*Cali Mafia* leverages cutting-edge blockchain technologies to provide a fair, secure, and immersive gaming experience.  
This repository includes:  
- The **public-facing frontend** for players to interact with the game.  
- The **Starknet smart contract** that powers the game logic and ensures transparent and efficient gameplay.

---

## **Features**

### **Public Frontend**  
- **Role Assignment & Game Progression:** Players can join the game, vote for a moderator, and track the game’s progress.  
- **Voting System:** Players can cast their votes for suspected Mafia members, with results transparently recorded on-chain.  
- **Seamless Gameplay Experience:** The frontend ensures a user-friendly interface with real-time updates.  

### **Starknet Contract**  
- **Game Logic Implementation:** Handles player roles, voting, elimination, and victory conditions.  
- **Commit-Reveal Mechanism:** Ensures role secrecy by committing roles to the blockchain and revealing them at the appropriate time.  
- **On-Chain Transparency:** All decisions and actions are verifiable on-chain for fairness.  

---

## **Tech Stack**

- **Frontend:**  
  - Built with modern web technologies like React.js or Next.js for an intuitive user experience.  
  - Connected to the Starknet contract for seamless interaction with the blockchain.  

- **Backend:**  
  - Powered by **Starknet**, a layer-2 ZK-rollup on Ethereum, for scalable and transparent smart contract execution.  

---

## **Getting Started**

### **Prerequisites**  
1. **Node.js** (v22 or later)  
2. **npm**  
3. **Starkli** (for deploying and interacting with the smart contract)  
4. **Scarb** (for Cairo development)  

---

### **Installation**

#### **Clone the Repository**  
```bash
git clone https://github.com/Demigod345/mafia.git cali-mafia-frontend
cd cali-mafia-frontend
```

#### **Install Dependencies**  
```bash
npm install
```

---

### **Set Up Environment Variables**  
Create a `.env` file using the `.env.sample` file as a template:  
```bash
cp .env.sample .env
```
Make sure to update the `.env` file with the appropriate values.

---

### **Run the Frontend Locally**  
```bash
npm run dev
```

Open your browser and navigate to `http://localhost:3000`.

---

### **Starknet Contract Deployment**  
The Starknet contract powering the game logic is located in the `contracts` directory. To deploy the contract:  

1. Ensure your Starknet environment is set up correctly.  
2. Use the deployment script to deploy the contract:  
   ```bash
   ./deploy.sh
   ```

---

## **How It Works**

1. **Role Assignment:**  
   Roles are assigned and committed to the blockchain to ensure secrecy.  
2. **Mafia Discussions:**  
   Mafia members strategize in private Calimero contexts.  
3. **Voting and Elimination:**  
   Players vote to eliminate suspected Mafia members, and results are transparently recorded on-chain.  
4. **Game Progression:**  
   As players are eliminated, their roles are revealed, and the game continues until either the Mafia or Villagers win.  

---

## **Future Enhancements**

- Integration with private Calimero contexts for Mafia member discussions (covered in a separate repository).  
- Improved UI/UX for a more immersive gameplay experience.  
- Multi-language support for broader accessibility.  

---

## **Contributing**

We welcome contributions from the community! To contribute:  
1. Fork the repository.  
2. Create a feature branch:  
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:  
   ```bash
   git commit -m "Add feature-name"
   ```
4. Push your branch:  
   ```bash
   git push origin feature-name
   ```
5. Create a pull request.  

---

## **License**

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## **Contact**

For questions or feedback, feel free to reach out:  
- **Author:** Divyansh Jain  
- **Email:** [divyanshjain.2206@gmail.com](mailto:divyanshjain.2206@gmail.com)  
