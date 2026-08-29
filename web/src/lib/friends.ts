export type Friend = {
  id: string;
  name: string;
  petName: string;
  petMood: string;
  trait: string;
  color: string;
  accent: string;
  status: string;
  level: number;
  xp: number;
  xpMax: number;
};

export const FRIENDS: Friend[] = [
  {
    id: "maya",
    name: "Maya",
    petName: "Bramble",
    petMood: "Happy",
    trait: "Curious little explorer",
    color: "#7ec9c1",
    accent: "#2d7a75",
    status: "Chewing on a leaf",
    level: 5,
    xp: 120,
    xpMax: 180,
  },
  {
    id: "liam",
    name: "Liam",
    petName: "Clover",
    petMood: "Sleepy",
    trait: "Enjoys warm sunlight",
    color: "#f4c67b",
    accent: "#b06d29",
    status: "Napping by the window",
    level: 3,
    xp: 90,
    xpMax: 150,
  },
  {
    id: "zoe",
    name: "Zoe",
    petName: "Juniper",
    petMood: "Playful",
    trait: "Chases every sparkle",
    color: "#b9d494",
    accent: "#507c3c",
    status: "Battling a toy worm",
    level: 7,
    xp: 140,
    xpMax: 200,
  },
];
