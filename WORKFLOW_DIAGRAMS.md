# Workflow Diagrams

Visual representations of each n8n workflow in the Job Scout suite.

## System Overview

```mermaid
flowchart TD
    subgraph "Job Sources"
        A1[LinkedIn API]
        A2[JSearch API]
        A3[Indeed API]
        A4[Adzuna API]
        A5[Remote OK]
        A6[Remotive]
        A7[The Muse]
    end
    
    subgraph "Daily Scout<br/>7AM Daily"
        B1[Aggregate Jobs]
        B2[Normalize & Dedupe]
        B3[AI Score with Gemini]
        B4[Filter Score > 45]
    end
    
    subgraph "Dream Scout<br/>8AM Daily"
        C1[Senior Role Search]
        C2[Normalize & Dedupe]
        C3[AI Dream Scoring]
        C4[Filter Score > 80]
    end
    
    subgraph "Central Storage"
        D[Notion Database<br/>Job Tracker]
    end
    
    subgraph "Notifications"
        E1[Email Summary]
        E2[Discord Alerts]
        E3[Daily Nudge 5PM]
    end
    
    subgraph "Application Tools"
        F1[Apply From URL<br/>On-Demand]
        F2[Doc Generator<br/>Every 10 min]
        F3[Google Docs<br/>Resume & Cover]
    end
    
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    A5 --> B1
    A6 --> B1
    A7 --> B1
    
    A2 --> C1
    A3 --> C1
    A4 --> C1
    A5 --> C1
    
    B1 --> B2 --> B3 --> B4 --> D
    C1 --> C2 --> C3 --> C4 --> D
    
    B4 --> E1
    B4 --> E2
    C4 --> E1
    C4 --> E2
    
    D --> E3
    D --> F2
    F1 --> D
    F2 --> F3
    
    style D fill:#f3e5f5,stroke:#9c27b0,stroke-width:3px
    style B3 fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    style C3 fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
```

## Data Flow

```mermaid
sequenceDiagram
    participant JS as Job Sources
    participant DS as Daily Scout
    participant AI as Gemini AI
    participant DB as Notion DB
    participant U as User
    participant DG as Doc Generator
    participant GD as Google Docs

    Note over DS: Runs at 7AM daily
    JS->>DS: Fetch jobs from 8 sources
    DS->>DS: Normalize & deduplicate
    DS->>AI: Score jobs (batch)
    AI-->>DS: Scores & insights
    DS->>DS: Filter score > 45
    DS->>DB: Create job pages
    DS->>U: Email summary
    DS->>U: Discord notification
    
    Note over DB,DG: Every 10 minutes
    DB->>DG: Check for "Applying" status
    DG->>AI: Generate tailored docs
    AI-->>DG: Resume & cover letter
    DG->>GD: Create documents
    DG->>DB: Update with links
    DG->>U: Discord notification
```

---

# Individual Workflow Details

## Job Search - Daily Scout

```mermaid
flowchart TD
    %% Daily job aggregation and scoring workflow
    ST[["🕐 Daily 7AM<br/>Schedule Trigger"]]:::trigger
    WH[["🌐 On Demand<br/>Webhook"]]:::trigger
    
    %% Job Sources
    LS["🌐 LinkedIn Search<br/>25 jobs"]:::api
    AS["🌐 Adzuna Search<br/>20 jobs"]:::api
    RS["🌐 Remotive Search<br/>20 jobs"]:::api
    JS1["🌐 JSearch - SRE<br/>2 pages"]:::api
    JS2["🌐 JSearch - Network<br/>2 pages"]:::api
    IS["🌐 Indeed Search"]:::api
    RO["🌐 Remote OK Search"]:::api
    MS["🌐 The Muse Search"]:::api
    
    %% Merge nodes
    M1["🔀 Merge AB"]:::merge
    M2["🔀 Merge CD"]:::merge
    M3["🔀 Merge EF"]:::merge
    M4["🔀 Merge GH"]:::merge
    M5["🔀 Merge ABCD"]:::merge
    M6["🔀 Merge EFGH"]:::merge
    M7["🔀 Merge All"]:::merge
    
    %% Processing
    NF["⚙️ Normalize + Filter<br/>+ Dedup"]:::code
    FP["⚙️ Format Claude Prompt<br/>Candidate Profile"]:::code
    AI["🤖 Gemini AI Score<br/>Batch Processing"]:::ai
    PS["⚙️ Parse Scores<br/>Extract JSON"]:::code
    
    %% Output
    PN["⚙️ Prepare Notion Body"]:::code
    CN["📝 Create Notion Page"]:::notion
    BR["⚙️ Build Reports"]:::code
    DA["🔔 Discord Alert"]:::discord
    EM["📧 Send Gmail"]:::email
    WT["⏸️ Rate Limit Wait"]:::wait
    
    %% Connections
    ST --> LS
    WH --> LS
    
    LS --> M1
    AS --> M1
    RS --> M2
    M1 --> M5
    M2 --> M5
    
    JS1 --> M3
    JS2 --> M3
    IS --> M4
    RO --> M4
    MS --> M6
    M3 --> M6
    M4 --> M6
    
    M5 --> M7
    M6 --> M7
    
    M7 --> NF --> FP --> AI --> PS --> PN --> CN
    PS --> BR --> DA
    BR --> EM
    CN --> WT
    WT --> CN
    
    classDef trigger fill:#e1f5e1,stroke:#4caf50,stroke-width:2px
    classDef api fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef code fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:3px
    classDef notion fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef email fill:#fce4ec,stroke:#e91e63,stroke-width:2px
    classDef discord fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
    classDef merge fill:#f5f5f5,stroke:#9e9e9e,stroke-width:2px
    classDef wait fill:#efebe9,stroke:#795548,stroke-width:2px
```

## Job Search - Dream Scout

```mermaid
flowchart TD
    %% Dream job search workflow - high bar filtering
    ST[["🕐 Daily 8AM<br/>Schedule Trigger"]]:::trigger
    WH[["🌐 On Demand<br/>Webhook"]]:::trigger
    
    %% Job Sources (more targeted)
    JP1["🌐 JSearch - Platform/Infra<br/>Staff/Senior roles"]:::api
    JP2["🌐 JSearch - Polymath<br/>Lead positions"]:::api
    AS["🌐 Adzuna Search<br/>Senior filter"]:::api
    RS["🌐 Remotive Search<br/>Senior roles"]:::api
    IS["🌐 Indeed Search<br/>Lead/Staff"]:::api
    RO["🌐 Remote OK Search"]:::api
    MS["🌐 The Muse Search<br/>Senior"]:::api
    
    %% Merge nodes
    M1["🔀 Merge AB"]:::merge
    M2["🔀 Merge CD"]:::merge
    M3["🔀 Merge EF"]:::merge
    M4["🔀 Merge ABCD"]:::merge
    M5["🔀 Merge EFG"]:::merge
    M6["🔀 Merge All"]:::merge
    
    %% Processing
    NF["⚙️ Normalize + Filter<br/>+ Dedup"]:::code
    FD["⚙️ Format Dream Prompt<br/>High-bar criteria"]:::code
    AI["🤖 Gemini AI Score<br/>Dream evaluation"]:::ai
    PD["⚙️ Parse Dream Scores"]:::code
    
    %% Conditional
    HD{{"❓ Has Dream Jobs?<br/>Score >= 80"}}:::decision
    
    %% Output
    PN["⚙️ Prepare Notion Body"]:::code
    CN["📝 Create Notion Page<br/>Dream tier only"]:::notion
    BR["⚙️ Build Dream Report"]:::code
    DA["🔔 Discord Alert<br/>High priority"]:::discord
    EM["📧 Send Gmail<br/>Dream jobs found"]:::email
    
    %% Connections
    ST --> JP1
    WH --> JP1
    
    JP1 --> M1
    JP2 --> M1
    AS --> M2
    RS --> M2
    M1 --> M4
    M2 --> M4
    
    IS --> M3
    RO --> M3
    MS --> M5
    M3 --> M5
    
    M4 --> M6
    M5 --> M6
    
    M6 --> NF --> FD --> AI --> PD --> HD
    HD -->|Yes| PN --> CN
    HD -->|No| BR
    CN --> BR
    BR --> DA
    BR --> EM
    
    classDef trigger fill:#e1f5e1,stroke:#4caf50,stroke-width:2px
    classDef api fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef code fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:3px
    classDef notion fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef email fill:#fce4ec,stroke:#e91e63,stroke-width:2px
    classDef discord fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
    classDef merge fill:#f5f5f5,stroke:#9e9e9e,stroke-width:2px
    classDef decision fill:#fffde7,stroke:#fbc02d,stroke-width:3px
```

## Job Apply From URL

```mermaid
flowchart TD
    %% On-demand workflow to generate application docs from URL
    WT[["🌐 Webhook Trigger<br/>POST with URL"]]:::trigger
    
    EU["⚙️ Extract URL<br/>from payload"]:::code
    FJ["🌐 Fetch via Jina<br/>Extract content"]:::api
    BP["⚙️ Build Apply Prompt<br/>+ Resume text"]:::code
    CG["🤖 Claude Generate Docs<br/>Tailored content"]:::ai
    PD["⚙️ Parse Apply Docs<br/>Extract sections"]:::code
    
    %% Google Docs creation
    CR["📄 Create Resume Doc<br/>Google Docs"]:::gdocs
    IR["📄 Insert Resume Content<br/>Formatted"]:::gdocs
    CC["📄 Create Cover Letter<br/>Google Docs"]:::gdocs
    IC["📄 Insert Cover Content<br/>Formatted"]:::gdocs
    
    %% Organization
    CF["📁 Create App Folder<br/>Google Drive"]:::gdrive
    MR["📁 Move Resume<br/>to Folder"]:::gdrive
    MC["📁 Move Cover Letter<br/>to Folder"]:::gdrive
    
    %% Notion tracking
    BN["⚙️ Build Notion Body"]:::code
    CN["📝 Create Notion Page<br/>Track application"]:::notion
    DN["🔔 Discord Notify<br/>Docs ready"]:::discord
    
    %% Flow
    WT --> EU --> FJ --> BP --> CG --> PD
    PD --> CR --> IR --> MR
    PD --> CC --> IC --> MC
    PD --> CF
    CF --> MR
    CF --> MC
    MC --> BN --> CN --> DN
    
    classDef trigger fill:#e1f5e1,stroke:#4caf50,stroke-width:2px
    classDef api fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef code fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:3px
    classDef notion fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef discord fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
    classDef gdocs fill:#e8f5e9,stroke:#0f9d58,stroke-width:2px
    classDef gdrive fill:#e3f2fd,stroke:#4285f4,stroke-width:2px
```

## Job Application Doc Generator

```mermaid
flowchart TD
    %% Automated doc generation for jobs marked "Applying"
    ST[["🕐 Every 10 Min<br/>Schedule Trigger"]]:::trigger
    
    QA["📝 Query Applying Jobs<br/>Notion Database"]:::notion
    CE["⚙️ Check & Extract Page<br/>Get first job"]:::code
    GD["⚙️ Guard Duplicate<br/>Prevent double-run"]:::code
    EP["⚙️ Extract Page Info"]:::code
    GB["📝 Get Page Blocks<br/>Full description"]:::notion
    ED["⚙️ Extract Description"]:::code
    
    BP["⚙️ Build Prompt<br/>with Resume"]:::code
    RC["⚙️ Resume Content<br/>Base template"]:::code
    CG["🤖 Claude Generate<br/>Tailored docs"]:::ai
    PD["⚙️ Parse Docs<br/>Format output"]:::code
    
    %% Google Docs
    CR["📄 Create Resume Doc"]:::gdocs
    IR["📄 Insert Resume<br/>Formatted"]:::gdocs
    CC["📄 Create Cover Letter"]:::gdocs
    IC["📄 Insert Cover<br/>Formatted"]:::gdocs
    
    %% Organization
    CF["📁 Create App Folder"]:::gdrive
    MR["📁 Move Resume"]:::gdrive
    MC["📁 Move Cover Letter"]:::gdrive
    
    %% Update tracking
    BU["⚙️ Build Update Data"]:::code
    UN["📝 Update Notion<br/>Status & Links"]:::notion
    DN["🔔 Discord Notify"]:::discord
    CL["⚙️ Clear Lock"]:::code
    
    %% Flow
    ST --> QA --> CE --> GD --> EP --> GB --> ED --> BP
    RC --> BP
    BP --> CG --> PD
    PD --> CR --> IR --> MR
    PD --> CC --> IC --> MC
    PD --> CF
    CF --> MR
    CF --> MC
    MC --> BU --> UN --> DN --> CL
    
    classDef trigger fill:#e1f5e1,stroke:#4caf50,stroke-width:2px
    classDef notion fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef code fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:3px
    classDef discord fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
    classDef gdocs fill:#e8f5e9,stroke:#0f9d58,stroke-width:2px
    classDef gdrive fill:#e3f2fd,stroke:#4285f4,stroke-width:2px
```

## Job Scout - Apply Nudge

```mermaid
flowchart TD
    %% Simple daily reminder workflow
    ST[["🕐 Daily 5PM<br/>Schedule Trigger"]]:::trigger
    QN["📝 Query New Jobs<br/>Today's matches"]:::notion
    FM["⚙️ Format Message<br/>Job summary"]:::code
    PD["🔔 Post to Discord<br/>Daily reminder"]:::discord
    
    ST --> QN --> FM --> PD
    
    classDef trigger fill:#e1f5e1,stroke:#4caf50,stroke-width:2px
    classDef notion fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef code fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef discord fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px
```

## Workflow Interactions

```mermaid
flowchart LR
    subgraph "Scheduled Workflows"
        DS[Daily Scout<br/>7AM]
        DR[Dream Scout<br/>8AM]
        DG[Doc Generator<br/>Every 10min]
        AN[Apply Nudge<br/>5PM]
    end
    
    subgraph "On-Demand"
        AU[Apply From URL<br/>Manual trigger]
    end
    
    subgraph "Storage"
        ND[(Notion DB)]
        GD[(Google Drive)]
    end
    
    subgraph "User"
        U[You]
    end
    
    DS --> ND
    DR --> ND
    AU --> ND
    AU --> GD
    
    ND --> DG
    DG --> GD
    DG --> ND
    
    ND --> AN
    AN --> U
    
    DS --> U
    DR --> U
    DG --> U
    AU --> U
    
    U --> AU
    
    style ND fill:#f3e5f5,stroke:#9c27b0,stroke-width:3px
    style GD fill:#e3f2fd,stroke:#4285f4,stroke-width:2px
```