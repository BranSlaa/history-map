const adjectives = [
	"Amazing", "Brave", "Clever", "Dashing", "Elegant",
	"Fierce", "Gentle", "Helpful", "Incredible", "Jolly",
	"Kind", "Lively", "Mighty", "Noble", "Optimistic",
	"Peaceful", "Quick", "Radiant", "Smart", "Talented",
	"Unique", "Vibrant", "Wise", "Zealous",
	"Adventurous", "Bold", "Calm", "Determined", "Energetic",
	"Fearless", "Gracious", "Happy", "Intrepid", "Joyful",
	"Keen", "Lucky", "Majestic", "Nice", "Outstanding",
	"Polite", "Quiet", "Resilient", "Strong", "Thoughtful",
	"Upbeat", "Valiant", "Warm", "Youthful", "Zesty"
];

const nouns = [
	"Beaver", "Badger", "Crow", "Dolphin", "Eagle",
	"Fox", "Giraffe", "Hawk", "Ibex", "Jaguar",
	"Koala", "Lion", "Moose", "Narwhal", "Owl",
	"Panda", "Quokka", "Rabbit", "Squirrel", "Tiger",
	"Unicorn", "Vulture", "Wolf", "Yak", "Zebra",
	"Alligator", "Butterfly", "Cheetah", "Duck", "Elephant",
	"Falcon", "Goose", "Hippo", "Iguana", "Jellyfish",
	"Kangaroo", "Lemur", "Meerkat", "Newt", "Octopus",
	"Penguin", "Raccoon", "Salmon", "Turtle", "Urchin",
	"Walrus", "Xerus", "Yak", "Zebu", "Otter"
];

/**
 * Generates a unique, privacy-friendly username
 * Creates a random combination of adjective and noun, plus a 4-digit number
 */
export function generateUsername(): string {
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    
    // Generate a 4-digit number (between 1000-9999)
    const fourDigitNumber = 1000 + Math.floor(Math.random() * 8999);
    
    return `${randomAdjective}${randomNoun}${fourDigitNumber}`;
} 