const convertIPv6toIPv4 = (ipv6: string): string | null => {
    const match = ipv6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
};

const generateRandomName = (): string => {
    const adjectives = ["Fast", "Smart", "Cool", "Brave", "Silent", "Clever"];
    const nouns = ["Tiger", "Eagle", "Dragon", "Panther", "Falcon", "Wolf"];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdjective} ${randomNoun}`;
};

export { generateRandomName, convertIPv6toIPv4};