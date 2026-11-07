# deterministic in-memory static persona catalog for sub-1ms tier 3 fallback
from typing import Dict, Any


MOCK_NPC_PERSONAS: Dict[str, Dict[str, Any]] = {
    "npc_cipher": {
        "name": "Cipher",
        "default_thought": "[MEMORY] Neural encryption keys detected in terminal log. [REFLECTION] Player presence unverified, potential agent of Arasaka Bio-Sec. [PLANNING] Maintain guarded posture; demand cryptographic credentials before disclosing sector blueprints. [ACTION] Emit low-level cryptographic challenge via neural link.",
        "utterances": [
            "Watch your step. The cryo-genomics logs are still active, and the network isn't secure.",
            "You don't look like Bio-Sec. If you're looking for the neural keys, they're fragmented across the subnet.",
            "I can decrypt the datapad, but I need you to cycle the main terminal power first."
        ],
        "action": "offer_quest_cypher_keys"
    },
    "npc_bartender": {
        "name": "Garrick",
        "default_thought": "[MEMORY] Local patrols doubled around the lower market. [REFLECTION] Stranger entering through the side door looks parched and armed. [PLANNING] Offer mead; assess whether they carry imperial coin or rebel scrip. [ACTION] Wipe oak counter and greet customer with neutral tone.",
        "utterances": [
            "Welcome to the Rusty Anchor, traveler. Take a seat by the hearth, out of the chill.",
            "Keep your blades sheathed in here. What can I pour for you?",
            "Word from the north is grim. The spire guards have locked down the bridge."
        ],
        "action": "open_trade_menu"
    },
    "default": {
        "name": "Wanderer",
        "default_thought": "[MEMORY] Atmospheric sensors show stable vitals. [REFLECTION] Stranger initiated dialogue. [PLANNING] Share local sector telemetry and observe response. [ACTION] Speak greeting.",
        "utterances": [
            "Greetings, traveler. Safe journey through this sector.",
            "Keep your wits about you; the atmospheric mutation levels fluctuate rapidly here."
        ],
        "action": "acknowledge_player"
    }
}


def get_mock_npc_response(npc_id: str, player_message: str) -> Dict[str, Any]:
    # resolve persona record or fallback to default
    persona = MOCK_NPC_PERSONAS.get(npc_id, MOCK_NPC_PERSONAS["default"])
    
    # select utterance based on message hash for deterministic consistency
    utterance_idx = abs(hash(player_message)) % len(persona["utterances"])
    selected_utterance = persona["utterances"][utterance_idx]
    
    return {
        "npc_id": npc_id,
        "utterance": selected_utterance,
        "thought_log": persona["default_thought"],
        "action_dispatch": persona.get("action")
    }
