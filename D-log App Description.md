# Business Application Manager 

Multi-Site Infrastructure, Asset Monitoring and Incident Management Platform 

|**Candidate name**|Sorin Craciunescu|
|---|---|
|**Date received**|03.08.2026|
|**Submission deadline**|10.08.2026|
|**Repository link**||
|**Applicaton URL**||



#### **Purpose** 

This exercise evaluates hands-on software development, infrastructure design, security, troubleshooting, deployment, documentation and the ability to convert operational requirements into a reliable business solution. 

Confidential | Prepared for candidate assessment by DLOG 

## **1. Candidate Instructions** 

#### **Important** 

The objective is not to build a perfect enterprise platform. The objective is to demonstrate sound architecture, working code, security awareness, infrastructure competence and clear prioritisation. 

### **Expected effort** 

- Target working time: approximately 12–16 hours. 

- Submission window: five to seven calendar days, unless otherwise agreed. 

- The candidate must report the actual time spent and identify any functions not completed. 

### **Rules** 

- The solution must be personally understood and defensible by the candidate. 

- Open-source libraries, documentation and AI-assisted tools may be used, but their use must be declared. 

- The candidate remains responsible for all submitted code, architecture and security decisions. 

- Do not include real DLOG passwords, confidential data or production credentials. 

- Use fictional or generated data only. 

- The application must be reproducible from the submitted instructions. 

- The repository must show meaningful development history rather than one final bulk upload. 

### **Technology choice** 

The candidate may select the technology stack. The choice must be explained in the Design Decisions section. A JavaScript/TypeScript implementation is acceptable, but no specific framework is mandatory. 

As the tech Stack we will use: React Functional Components, NodeJS and ExpressJS for the backend, and SupaBase for the database.

### **Minimum demonstration** 

- A reviewer must be able to start the application locally. 

- The candidate must present a working user journey and at least one operational alert. 

- The candidate must explain the security model, database model and infrastructure proposal. 

- The candidate must be prepared to modify the solution during a live technical session. 

## **2. Business Scenario** 

DLOG operates several offices, warehouses and operational sites. The organisation needs one central platform to manage IT assets, monitor equipment health, handle incidents and provide management visibility. 

|**Site**|**Country**|**Typical environment**|
|---|---|---|
|Bucharest Head Ofce|Romania|Management, fnance and central<br>functons|
|Ploieșt Warehouse|Romania|Warehouse, WMS workstatons and<br>scanners|
|Valladolid Warehouse|Spain|Warehouse, client operatons and local<br>users|
|Novo Mesto Operatonal Site|Slovenia|Operatonal teams and shared equipment|
|Wrocław Operatonal Site|Poland|Operatonal teams and remote support|



### **Current challenge** 

- There is no complete and trusted central inventory of IT equipment. 

- Management cannot easily see which devices are online, out of warranty or affected by incidents. 

- Incident handling and SLA follow-up are not centralised. 

- Backups, connectivity and critical device health are not visible in one dashboard. 

- Auditability is required: every important change must identify who changed what and when. 

- The infrastructure must support secure multi-site operations and remote support. 

### **Typical equipment** 

Laptops, desktops, managed switches, routers, firewalls, Wi-Fi access points, printers, barcode scanners, smart televisions, CCTV equipment, local workstations, UPS devices and other operational hardware. 

## **3. Required Solution** 

Design and implement a working minimum viable product named **DLOG IT Operations Platform** . The solution must contain the following modules. 

### **3.1 Authentication and role-based access** 

|**Role**|**Minimumpermission**|
|---|---|
|Administrator|Manage users,roles,sites,assets,incidents and confguraton.|
|IT Technician|<br>Manage assigned incidents, update assets and review<br>monitoringalerts.|
|Site Manager|View and manage permited records for the manager’s own site<br>only.|
|Management Viewer|Read-onlyaccess to dashboards and reports.|



#### **Security requirement** 

Permissions must be enforced by the backend or server layer. Hiding a button in the user interface is not sufficient. 

### **3.2 IT asset management** 

Each asset must contain at least: 

- Unique asset ID 

- Serial number 

- Asset category 

- Manufacturer and model 

- Site 

- Assigned employee 

- IP address 

- MAC address 

- Operating system 

- Purchase date 

- Warranty expiration date 

- Status 

- Last online timestamp 

### **•** Notes 

The application must reject duplicate asset IDs and duplicate serial numbers. 

### **3.3 Incident management** 

Each incident must contain at least: 

- Unique incident number 

- Site 

- Related asset 

- Priority 

- Category 

- Description 

- Assigned technician 

- Status 

- Creation date 

- Response deadline 

- Resolution deadline 

- Resolution notes 

The application must calculate and display whether an incident is within or outside its SLA. 

### **3.4 Device heartbeat and monitoring** 

Create a protected API endpoint that receives a heartbeat from a device or monitoring agent. The following payload is an example; equivalent structures are acceptable: 

{ "assetId": "PLT-LAP-001", "timestamp": "2026-07-30T09:35:00Z", "ipAddress": "192.168.20.45", "cpuUsage": 42, "memoryUsage": 71, "diskFreePercent": 16, "backupStatus": "failed" } 

The monitoring process must: 

- Validate and authenticate the sender. 

- Update the asset’s last-online timestamp. 

- Store the monitoring result. 

- Create an alert when free disk space is below 15%. 

- Create an alert when a backup fails. 

- Avoid unlimited duplicate alerts for the same unresolved problem. 

### **3.5 Dashboard** 

- Assets by site and category. 

- Online versus offline assets. 

- Open incidents by priority. 

- Incidents outside SLA. 

- Devices with warranties approaching expiration. 

- Failed backups. 

- Open infrastructure or security alerts. 

### **3.6 Audit trail** 

For important changes, store: 

- User or system source 

- Entity changed 

- Previous value 

- New value 

- Timestamp 

Audit records must not be editable through the normal application interface. 

## **4. Technical and Coding Requirements** 

### **4.1 Mandatory engineering requirements** 

- Clear and maintainable project structure. 

- Server-side input validation. 

- Centralised error handling. 

- Secure configuration through environment variables. 

- Reproducible database schema or migrations. 

- Secure password hashing, or documented external identity integration. 

- Backend authorisation and site-level data filtering. 

- Pagination and filtering for large lists. 

- Structured application logging. 

- API documentation. 

- No secrets committed to the source repository. 

- At least ten meaningful automated tests. 

### **4.2 Deployment** 

The preferred submission contains Docker and Docker Compose, or another comparably 

reproducible deployment method. The reviewer must be able to start the solution using clear instructions. 

- Document required software and versions. 

- Provide sample environment configuration without real secrets. 

- Provide database initialisation or seed data. 

- Provide test credentials for each user role. 

- Explain production deployment and rollback at a high level. 

### **4.3 Non-trivial logic** 

At least one of the following must be implemented and explained in depth: SLA calculation, alert deduplication, role-based site filtering, offline event synchronisation, escalation workflow or another comparable business rule. 

### **4.4 Security baseline** 

- Protect against common injection and authentication weaknesses. 

- Use least-privilege access. 

- Rate-limit or otherwise protect sensitive endpoints where appropriate. 

- Do not expose the database directly to the public internet. 

- Explain session/token expiry and revocation. 

- Explain how logs avoid exposing passwords, tokens or unnecessary personal data. 

## **8. Candidate Response Template** 

Complete the following sections and include them in the submission. 

### **8.1 Executive summary** 

Summarise the solution, scope completed and principal design choices. 

______________________________________________________________________________ 


______________________________________________________________________________ 


### **8.2 Technology stack** 

List frontend, backend, database, deployment, testing and infrastructure tools. Explain why each was selected. 

______________________________________________________________________________ 

______________________________________________________________________________ 


______________________________________________________________________________ 

### **8.3 Application architecture** 

Describe modules, data flow, authentication, authorisation and major business rules. 

______________________________________________________________________________ 

______________________________________________________________________________ 


______________________________________________________________________________ 


### **8.4 Database model** 

Explain core entities, relationships, constraints, indexes and audit storage. 

______________________________________________________________________________ 

______________________________________________________________________________ 


______________________________________________________________________________ 


### **8.5 Security model** 

Describe identity, token/session management, permission enforcement, secrets, logging and endpoint protection. 

______________________________________________________________________________ 


______________________________________________________________________________ 


______________________________________________________________________________ 


### **8.9 Testing approach** 

List automated tests and explain what risks they cover. 

______________________________________________________________________________ 

______________________________________________________________________________ 


______________________________________________________________________________ 


### **8.10 Known limitations and next steps** 

Be explicit about shortcuts, incomplete features and production improvements. 

______________________________________________________________________________ 


______________________________________________________________________________ 



### **8.11 Time report** 

Record hours spent by analysis, development, testing, infrastructure design and documentation. 

______________________________________________________________________________ 


______________________________________________________________________________ 


