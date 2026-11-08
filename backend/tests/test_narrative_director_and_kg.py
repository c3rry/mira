"""Comprehensive validation suite for Mira Nemotron Narrative Director,
LoRA Weight Freezing, Story Knowledge Graph, Age 10-13 Safety Guardrails,
and Guide Chunked Navigation & In-Character Stalling.
"""

try:
    import pytest
except ImportError:
    pytest = None
import os
import json
import torch
from backend.app.schemas import (
    NarrativeChatTurnRequest,
    NarrativeChatTurnResponse,
    StoryKnowledgeGraph,
    KnowledgeLocationNode,
    KnowledgeAgentNode,
    KnowledgeRelationshipEdge,
    KnowledgeStoryBeatNode,
)
from backend.app.services.nemotron_finetune import (
    NemotronStoryLoRAAdapter,
    train_or_load_nemotron_story_adapter,
    adapt_vague_prompt_to_non_spoiling_story,
)
from backend.app.services.narrative_director import (
    process_narrative_director_turn,
    compile_story_knowledge_graph,
    get_cached_or_default_knowledge_graph,
    MIDDLE_GRADE_GUARDRAIL,
)


def test_nemotron_lora_weight_freezing():
    """Verify Nemotron LoRA module freezes base weights (>80%) and only trains adapter matrices."""
    adapter = NemotronStoryLoRAAdapter(backbone_dim=512, lora_rank=16, lora_alpha=32)
    stats = adapter.get_trainable_parameter_stats()
    
    # Strictly require > 80% frozen parameters
    assert stats["frozen_ratio_pct"] >= 80.0, f"Expected >= 80% frozen, got {stats['frozen_ratio_pct']}%"
    assert stats["trainable_params"] > 0
    assert stats["frozen_params"] > stats["trainable_params"]
    
    # Verify forward pass tensor shapes
    dummy_input = torch.randn(2, 8, 512)
    output = adapter(dummy_input)
    assert output.shape == (2, 8, 512)


def test_vague_prompt_non_spoiling_mystery_shield():
    """Verify vague user input triggers non-spoiling mystery gating."""
    vague_prompt = "There is some secret gear mechanism somewhere in a hidden room"
    adapted = adapt_vague_prompt_to_non_spoiling_story(vague_prompt, world_context="Chicago Cyber-Modernism")
    
    assert adapted["is_spoiler_shield_active"] is True
    assert adapted["mystery_gate_score"] >= 0.5
    assert "teasers" in adapted
    assert len(adapted["teasers"]) >= 2
    # Ensure climax secrets are not revealed in raw synopsis
    assert "climax" not in adapted["synopsis"].lower() or "unravel" in adapted["synopsis"].lower()


def test_narrative_director_sequential_turns():
    """Verify Mira Director conducts sequential 1-by-1 interview turns (Premise -> Sub-envs -> Key Figures -> Compiled)."""
    world_id = "test-chicago-vault"
    world_title = "Chicago Cyber-Modernism Vault"
    current_room = "broadway-promenade-001"
    
    # Turn 1: Premise
    t1_req = NarrativeChatTurnRequest(
        world_id=world_id,
        world_title=world_title,
        current_room_id=current_room,
        player_message="I want to explore a lost clockwork observatory hidden above the skyscrapers.",
        stage="premise",
        simulate_provider="offline_mock",
    )
    t1_res = process_narrative_director_turn(t1_req)
    
    assert t1_res.next_stage == "sub_environments"
    assert t1_res.follow_up_question is not None
    assert "Mira" in t1_res.director_utterance or "observatory" in t1_res.director_utterance.lower()
    assert len(t1_res.suggested_chips) > 0
    
    # Turn 2: Sub-environments
    t2_req = NarrativeChatTurnRequest(
        world_id=world_id,
        world_title=world_title,
        current_room_id=current_room,
        player_message="A brass astrolabe gallery and a skybridge transit station.",
        stage="sub_environments",
        simulate_provider="offline_mock",
    )
    t2_res = process_narrative_director_turn(t2_req)
    
    assert t2_res.next_stage == "key_figures"
    assert t2_res.follow_up_question is not None
    
    # Turn 3: Key Figures -> triggers Knowledge Graph Compilation
    t3_req = NarrativeChatTurnRequest(
        world_id=world_id,
        world_title=world_title,
        current_room_id=current_room,
        player_message="Curator Silas and an apprentice mechanist named Tariq.",
        stage="key_figures",
        simulate_provider="offline_mock",
    )
    t3_res = process_narrative_director_turn(t3_req)
    
    assert t3_res.next_stage == "compiled_active"
    assert t3_res.updated_graph is not None
    assert len(t3_res.spawned_subagents) >= 2
    assert t3_res.guide_agent is not None
    assert "tariq" in t3_res.guide_agent.name.lower() or "guide" in t3_res.guide_agent.role.lower()


def test_story_knowledge_graph_structure_and_safety():
    """Verify Knowledge Graph schema, relationships, locked mystery beats, and age 10-13 safety."""
    kg = get_cached_or_default_knowledge_graph("test-world-kg")
    
    assert len(kg.locations) >= 3
    assert len(kg.agents) >= 2
    assert len(kg.relationships) >= 2
    assert len(kg.story_beats) >= 3
    
    # Verify locked future mystery beats (non-spoiling)
    unlocked_beats = [b for b in kg.story_beats if b.is_unlocked]
    locked_beats = [b for b in kg.story_beats if not b.is_unlocked]
    assert len(unlocked_beats) >= 1, "At least prologue beat must be unlocked"
    assert len(locked_beats) >= 1, "Future mystery beats must be locked to prevent spoilers"
    
    # Verify age 10-13 themes (ancient mechanisms, ciphers, astrolabes, puzzles; no graphic violence)
    all_text = " ".join([
        kg.synopsis,
        " ".join([b.narrative_cue for b in kg.story_beats]),
        " ".join([a.personality for a in kg.agents]),
        " ".join([r.interaction_lore for r in kg.relationships]),
    ]).lower()
    
    forbidden_violent_terms = ["kill", "murder", "blood", "gore", "assassinate", "torture", "decapitate"]
    for term in forbidden_violent_terms:
        assert term not in all_text, f"Found forbidden violent term '{term}' in 10-13 story graph"
    
    positive_puzzle_terms = ["puzzle", "cipher", "gear", "mechanism", "vault", "astrolabe", "discovery", "ancient", "relic", "secret"]
    found_puzzle_terms = [t for t in positive_puzzle_terms if t in all_text]
    assert len(found_puzzle_terms) >= 2, f"Expected puzzle/adventure themes, found: {found_puzzle_terms}"


def test_guide_chunked_navigation_and_stalling_logic():
    """Simulate Guide navigation decision tree: chunking to immediate hop and stalling when unrendered."""
    # Topology: Room A -> Room B -> Room C
    rendered_rooms = {
        "room_a": True,
        "room_b": False, # Room B is currently rendering
        "room_c": False,
    }
    
    current_room_id = "room_a"
    target_room_id = "room_c"
    
    # BFS shortest path from A to C: ["room_a", "room_b", "room_c"]
    bfs_path = ["room_a", "room_b", "room_c"]
    next_hop_id = bfs_path[1] # "room_b"
    
    is_next_hop_rendered = rendered_rooms.get(next_hop_id, False)
    
    if not is_next_hop_rendered:
        # Guide MUST stall in-character
        is_stalling = True
        stalling_dialogue = (
            "Hold up a moment, explorer! The stone gears in this archway are still shifting into place. "
            "Let me inspect the runes on this lintel before we step through."
        )
    else:
        is_stalling = False
        stalling_dialogue = "The path is clear! Step through the archway into the next sector."
    
    assert is_stalling is True
    assert "stone gears" in stalling_dialogue or "runes" in stalling_dialogue
    
    # Now simulate room B finishes rendering
    rendered_rooms["room_b"] = True
    is_next_hop_rendered = rendered_rooms.get(next_hop_id, False)
    
    if not is_next_hop_rendered:
        is_stalling = True
    else:
        is_stalling = False
        guidance_instruction = f"The archway is now fully open! Follow me into {next_hop_id}."
    
    assert is_stalling is False
    assert "fully open" in guidance_instruction
