"""Curated Singapore recycling knowledge base — the high-trust tier.

**Hand-written from public NEA guidance. Verify before judging.** These are the rules as
commonly published for Singapore households; they are not scraped from an authoritative
feed and nobody on the team should present them as an official NEA data source.

Facts are deliberately qualitative where a precise figure would be a hallucination risk.
Where a number appears, it is one that is widely and consistently published.

Each chunk is a self-contained answer. The retriever scores whole chunks, so a chunk
should read sensibly on its own when it is quoted back to a user verbatim - which is
exactly what happens when no model is available.

Chunks ingested from real NEA documents by `scripts/ingest.py` join these at search
time via `app.rag.store`. These carry no URL because they are hand-written rather
than quoted; ingested chunks always do.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Chunk:
    id: str
    topic: str
    text: str
    # Extra search terms a user would type that the text may not contain.
    #
    # These must DISCRIMINATE between chunks. Generic words that appear in nearly every
    # question - "bin", "dispose", "recycle", "where" - belong in the text, never here:
    # as keywords they fire on everything and drown the chunk that actually answers.
    keywords: tuple[str, ...] = field(default_factory=tuple)
    # Where this came from. Empty on curated chunks - they are written from public
    # NEA guidance rather than quoted from one document, and saying otherwise would
    # be a fabricated citation. Ingested chunks always carry both.
    source_url: str = ""
    source_title: str = ""


KNOWLEDGE: list[Chunk] = [
    # --- Blue bin basics ----------------------------------------------------
    Chunk(
        "blue-bin-basics",
        "blue bin",
        "Singapore's blue recycling bins are commingled: paper, plastic, metal and glass "
        "all go into the same bin, and are separated later at a materials recovery "
        "facility. You do not need to sort them yourself. Blue bins are provided at HDB "
        "blocks and at landed housing estates.",
        ("commingled", "sort", "separated", "same bin", "hdb"),
    ),
    Chunk(
        "blue-bin-accepted",
        "blue bin",
        "Accepted in the blue recycling bin: paper and cardboard, newspapers and "
        "magazines, plastic bottles and containers, metal drink and food cans, and glass "
        "bottles and jars. Empty and rinse containers first.",
        ("accepted", "allowed", "what can i put", "what items", "what goes", "list"),
    ),
    Chunk(
        "blue-bin-rejected",
        "blue bin",
        "Not accepted in the blue recycling bin: food waste, used tissues and paper "
        "towels, disposable wooden chopsticks, ceramics and crockery, mirrors, light "
        "bulbs, batteries, textiles and clothing, and electrical items. These belong in "
        "general waste or in a dedicated collection stream.",
        ("cannot", "not allowed", "rejected", "banned", "what cannot"),
    ),
    Chunk(
        "contamination",
        "contamination",
        "Contamination is the main reason recyclables end up incinerated. Food, liquid or "
        "grease on one item can spoil an entire bag of otherwise good recyclables. Rinse "
        "containers and let them dry before binning them. If something is too soiled to "
        "clean, general waste is the better choice.",
        ("contaminate", "dirty", "wash", "rinse", "clean", "soiled", "wet"),
    ),
    # --- Specific everyday items -------------------------------------------
    Chunk(
        "pizza-box",
        "paper",
        "A greasy pizza box does not go in the blue bin. Grease and food residue "
        "contaminate paper recycling. Tear off and recycle any clean parts of the lid, "
        "and put the greasy base in general waste.",
        ("pizza box", "greasy", "oily", "takeaway box", "food box"),
    ),
    Chunk(
        "styrofoam",
        "plastic",
        "Styrofoam and polystyrene foam are not accepted in Singapore's blue recycling "
        "bins. Foam food boxes, cup lids and packaging foam go into general waste.",
        ("styrofoam", "polystyrene", "foam", "eps"),
    ),
    Chunk(
        "plastic-bags",
        "plastic",
        "Clean plastic bags and clean plastic packaging can go into the blue bin, but they "
        "must be empty and free of food residue. Do not tie your recyclables inside a "
        "plastic bag - put them in loose, so the sorting facility can process them.",
        ("plastic bag", "carrier bag", "packaging", "wrapper"),
    ),
    Chunk(
        "plastic-containers",
        "plastic",
        "Plastic bottles and food containers are recyclable once emptied and rinsed. "
        "Remove and discard any food residue. Caps can usually stay on. Bottles do not "
        "need their labels removed.",
        ("plastic bottle", "container", "tub", "pet", "water bottle", "cap", "label"),
    ),
    Chunk(
        "glass",
        "glass",
        "Glass bottles and jars are accepted in the blue bin once rinsed. Broken glass, "
        "drinking glasses, mirrors, ceramics and crockery are not - they are a different "
        "material and a hazard to sorting staff. Wrap broken glass and put it in general "
        "waste.",
        ("glass", "jar", "bottle", "mirror", "ceramic", "crockery", "broken"),
    ),
    Chunk(
        "cans",
        "metal",
        "Metal drink cans and food tins are recyclable. Rinse them out first. Aluminium "
        "foil and foil trays can be recycled if they are clean and free of food.",
        ("can", "tin", "aluminium", "aluminum", "foil", "metal"),
    ),
    Chunk(
        "beverage-carton",
        "paper",
        "Beverage cartons such as milk and juice cartons can be recycled in the blue bin. "
        "Rinse them, and flatten them if you can.",
        ("carton", "milk", "juice", "tetra", "drink box"),
    ),
    Chunk(
        "textiles",
        "textiles",
        "Clothing and textiles do not go in the blue recycling bin. Use a dedicated "
        "clothing donation or textile recycling bin, or donate wearable items to a "
        "charity that collects them.",
        ("clothes", "clothing", "textile", "fabric", "shoes", "shirt", "tshirt", "donate"),
    ),
    # --- E-waste ------------------------------------------------------------
    Chunk(
        "ewaste-what",
        "e-waste",
        "E-waste is anything with a plug, a battery or a cable. Laptops, phones, "
        "chargers, cables, keyboards, kettles, hair dryers, batteries and light bulbs are "
        "all e-waste. None of it belongs in the blue recycling bin.",
        ("e-waste", "ewaste", "electronic", "electrical", "gadget", "device"),
    ),
    Chunk(
        "ewaste-why-separate",
        "e-waste",
        "Electronics are collected separately because they contain both hazardous "
        "substances and valuable recoverable materials. Batteries in particular can "
        "catch fire when crushed in a general waste or recycling truck. Separate "
        "collection keeps the hazards controlled and lets the metals be recovered.",
        ("why separate", "separately", "electronics", "hazardous", "fire", "lithium", "valuable"),
    ),
    Chunk(
        "ewaste-where",
        "e-waste",
        "E-waste collection points in Singapore are sited at shopping malls, community "
        "clubs, some MRT stations and many campuses and offices. Use the map in this app "
        "to find the nearest one. Regulated e-waste is handled through a national "
        "producer-responsibility scheme rather than by the blue bins.",
        ("e-waste bin", "collection point", "drop off", "nearest", "mall", "community club"),
    ),
    Chunk(
        "ewaste-laptop",
        "e-waste",
        "An old laptop or computer goes to an e-waste collection point, not the blue bin. "
        "Wipe or remove the drive first if it held personal data. Many retailers also "
        "take back old devices when you buy a replacement.",
        ("laptop", "computer", "pc", "notebook", "macbook", "hard drive", "data"),
    ),
    Chunk(
        "ewaste-phone",
        "e-waste",
        "Mobile phones and tablets are e-waste. Drop them at an e-waste collection point, "
        "or use a retailer trade-in. Factory reset the device and remove any SIM or "
        "memory card before handing it over.",
        ("phone", "mobile", "handphone", "tablet", "ipad", "smartphone"),
    ),
    Chunk(
        "ewaste-keyboard",
        "e-waste",
        "Keyboards, mice, cables and chargers are e-waste. They contain circuitry and "
        "metals and must not go into the blue recycling bin. Take them to an e-waste "
        "collection point.",
        ("keyboard", "mouse", "cable", "charger", "wire", "peripheral"),
    ),
    Chunk(
        "batteries",
        "e-waste",
        "Batteries never go in the blue recycling bin or in general waste. They are a "
        "fire risk when crushed. Use a dedicated battery collection box - these are "
        "common at supermarkets, malls and community clubs, often alongside the e-waste "
        "bin.",
        ("battery", "batteries", "aa", "aaa", "lithium", "power bank", "rechargeable"),
    ),
    Chunk(
        "bulbs",
        "e-waste",
        "Light bulbs, fluorescent tubes and lamps are collected as lighting waste, not in "
        "the blue bin. Some contain mercury. Look for a lighting waste collection point - "
        "they are often at the same malls and community clubs as e-waste bins.",
        ("bulb", "lamp", "light", "fluorescent", "led", "tube", "lighting"),
    ),
    Chunk(
        "large-appliances",
        "e-waste",
        "Large appliances such as fridges, washing machines, televisions and air "
        "conditioners are too big for a collection bin. They are collected through a free "
        "scheduled pick-up service, or taken back by the retailer when a replacement is "
        "delivered.",
        ("fridge", "refrigerator", "washing machine", "tv", "television", "aircon", "large"),
    ),
    # --- Downstream ---------------------------------------------------------
    Chunk(
        "what-happens-next",
        "process",
        "Recyclables from the blue bins are taken to a materials recovery facility, where "
        "they are sorted by material - paper, plastic, metal, glass - and baled, then sold "
        "on to recyclers who process them into raw material. Anything too contaminated to "
        "sort is sent for incineration instead.",
        ("what happens", "after", "afterwards", "mrf", "sorted", "facility", "collected"),
    ),
    Chunk(
        "incineration",
        "process",
        "Waste that is not recycled in Singapore is incinerated at waste-to-energy plants, "
        "which recover electricity and cut the volume of waste by roughly 90 percent. The "
        "remaining ash is barged to Semakau Landfill, Singapore's only landfill, which has "
        "finite remaining capacity. Recycling reduces the load on both.",
        ("incinerate", "burn", "semakau", "landfill", "waste to energy", "ash"),
    ),
    Chunk(
        "why-recycle",
        "process",
        "Singapore has one landfill, Semakau, and no space for another. Every tonne "
        "diverted from incineration extends its life. Domestic recycling rates in "
        "Singapore have stayed low compared with the overall national rate, so household "
        "behaviour is where the biggest gains remain.",
        ("why recycle", "why bother", "matter", "important", "landfill", "rate"),
    ),
    Chunk(
        "bulky-items",
        "process",
        "Bulky items such as furniture and mattresses are not recyclables. Town councils "
        "provide a free bulky item removal service, usually a set number of collections "
        "per household per year - arrange it with your town council.",
        ("furniture", "mattress", "sofa", "bulky", "town council"),
    ),
    Chunk(
        "food-waste",
        "food",
        "Food waste does not go in the blue recycling bin. Some estates and buildings have "
        "separate food waste digesters or collection; otherwise it goes into general "
        "waste. Empty food out of containers before recycling them.",
        ("food", "leftover", "organic", "compost", "kitchen"),
    ),
]


BY_ID: dict[str, Chunk] = {chunk.id: chunk for chunk in KNOWLEDGE}
