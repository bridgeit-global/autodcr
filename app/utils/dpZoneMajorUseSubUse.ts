export const DP_ZONE_OPTIONS = ["1","2","3","4","5","6","7"] as const;

export type DpZone = typeof DP_ZONE_OPTIONS[number];

export const DP_ZONE_TO_MAJOR_USE_TO_SUB_USE: Record<DpZone, Record<string, string[]>> = 
{
  "1": {
    "Assembly": [
      "Community Hall",
      "Religious Building"
    ],
    "Business": [
      "Home Occupation",
      "Professional Offices"
    ],
    "Institutional": [
      "Kindergarten",
      "School",
      "Training Institute"
    ],
    "Medical": [
      "Clinic",
      "Dispensary",
      "Nursing Home"
    ],
    "Mercantile": [
      "Convenience Shops",
      "Shop Line"
    ],
    "Residential": [
      "Affordable Housing (AH)",
      "Bungalow / Detached Dwelling",
      "CHS / Tenements",
      "Dormitory",
      "Hostel / Working Women Hostel",
      "MHADA Housing",
      "Rehabilitation & Resettlement (R&R)",
      "Residential Apartment",
      "Residential Hotel / Service Apartment",
      "Row House",
      "Semi-Detached",
      "Slum Rehabilitation (SRA)",
      "Staff Quarters / Police Housing",
      "Transit Camp Buildings"
    ],
    "Transport / Infra": [
      "Metro / Railway-related structures (where permissible)"
    ],
    "Utility": [
      "Creche",
      "Gym",
      "Parking",
      "Public Parking (PPL)",
      "Society Office",
      "Utility Rooms"
    ]
  },
  "2": {
    "Assembly": [
      "Auditorium",
      "Cinema Theatre",
      "Cultural Centre",
      "Exhibition Hall",
      "Exhibition-cum-Convention Centre",
      "Marriage Hall"
    ],
    "Business": [
      "Banks",
      "Corporate Office",
      "Data Centres",
      "FinTech Buildings",
      "IT / ITES / BPO",
      "Office Building"
    ],
    "Hospitality": [
      "Hotel",
      "Restaurant / Eating House"
    ],
    "Institutional": [
      "Govt / Administrative Office"
    ],
    "Medical": [
      "Diagnostic Centre",
      "Hospital"
    ],
    "Mercantile": [
      "Departmental Store",
      "Hypermarket",
      "Market",
      "Shopping Mall",
      "Shops",
      "Showroom"
    ],
    "Residential": [
      "Residential Apartment (mixed use)",
      "Residential Hotel"
    ],
    "Transport / Infra": [
      "Transit Oriented Development (TOD) components"
    ],
    "Utility": [
      "Parking (PPL)",
      "Utility Services"
    ]
  },
  "3": {
    "Business": [
      "Administrative Office (ancillary)"
    ],
    "Educational": [
      "Technical Training Institute"
    ],
    "Industrial": [
      "Biotechnology Buildings",
      "Factory",
      "Heavy / Light Industry",
      "IT Industry / IT Park",
      "Industrial Building",
      "Laboratory",
      "Non-polluting Industry",
      "Power / Gas Plant",
      "Refinery",
      "Service Industry"
    ],
    "Residential": [
      "Staff Quarters"
    ],
    "Storage": [
      "Cold Storage",
      "Data Centre",
      "Freight Complex",
      "Godown",
      "Logistics Hub",
      "Warehouse"
    ],
    "Transport / Infra": [
      "Transport / Freight Infrastructure"
    ],
    "Utility": [
      "Industrial Utilities",
      "Public Utility Infrastructure",
      "STP",
      "Substation"
    ]
  },
  "4": {
    "Mixed Use": [
      "Cluster Development / Special Schemes",
      "Commercial Offices",
      "Exhibition / Convention Centres",
      "Hotels",
      "IT / FinTech / Biotechnology Buildings",
      "Institutional Buildings",
      "Public Amenities",
      "Residential Buildings",
      "Retail / Mall"
    ]
  },
  "5": {
    "Business": [
      "Port Offices"
    ],
    "Industrial / Logistics": [
      "Cargo Handling",
      "Dock Activity",
      "Logistics Hub",
      "Port Operations",
      "Warehousing"
    ],
    "Residential": [
      "Essential Staff Quarters"
    ],
    "Utility": [
      "Port Infrastructure / Utility Systems"
    ]
  },
  "6": {
    "Assembly": [
      "Limited Eco Facilities"
    ],
    "Others": [
      "Any Urban Development"
    ],
    "Recreational / Environmental": [
      "Botanical Garden",
      "Eco-tourism",
      "Nature Education Centre",
      "Nature Trails",
      "Parks",
      "Zoological Park"
    ],
    "Transport / Infra": [
      "Limited infrastructure (environment compliant)"
    ],
    "Utility": [
      "Essential Services"
    ]
  },
  "7": {
    "Assembly": [
      "Club",
      "Gymkhana"
    ],
    "Commercial": [
      "Cafeteria"
    ],
    "Recreational": [
      "Garden",
      "Open Space",
      "Playground",
      "Sports Complex",
      "Stadium"
    ],
    "Transport / Infra": [
      "Public utility infrastructure (limited)"
    ],
    "Utility": [
      "Services",
      "Toilets"
    ]
  }
} as const;

