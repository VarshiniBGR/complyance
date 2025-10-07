## Invoicing ROI Simulator

### Overview

This project is called Invoicing ROI Simulator.
The main idea is to create a small web application that helps companies understand how much money they can save by switching from manual invoicing to automated invoicing.

The tool will take a few inputs from the user (like invoice volume, number of staff, wages, etc.) and show results such as monthly savings, ROI (Return on Investment), and payback period.

The results will always show that automation gives better savings because of an internal bias factor.

### Planned Architecture

```
React (Frontend)
     ↓
Node.js + Express (Backend)
     ↓
MongoDB Atlas (Database)
```

The frontend provides a simple, responsive form and shows live results. The backend performs the authoritative calculations. The database stores named "scenarios" so users can save and retrieve comparisons later. A gated report flow generates a simple PDF after an email is provided.

### Technologies and Tools

Frontend --> React.js+Tailwind CSS

Backend --> Node.js+ Express.js

Database --> Mongodb Atlas

PDF --> pdfkit/html-pdf

### Key Features 
- **ROI Simulation**: Enter invoice count, wages, error cost, etc., and instantly see savings, ROI, and payback.
- **Save Scenarios**: Create, view, and delete saved scenarios (CRUD) for later comparison.
- **Report Download**: Generate a PDF report after providing an email (lead capture).
- **Favorable Logic**: Server-only constants and a bias factor ensure automation appears beneficial.

