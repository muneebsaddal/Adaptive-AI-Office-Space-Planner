# Adaptive Space Planner Report

## Executive Summary

Adaptive Space Planner is a decision-support tool for workplace layout planning. It helps architects, facility teams, and workplace strategists understand how office geometry, seating, climate, time, and employee preferences affect comfort outcomes. The app turns a floor plan into an interactive planning surface, assigns employees to seats, estimates environmental conditions at each seat, and recommends interventions that can improve comfort across the space.

The project is designed for practical planning conversations: Where should each employee sit? Which zones create heat, glare, noise, or air quality pressure? Which design change produces the clearest improvement before the team invests in physical work?

## What The Project Does

The app supports four core workflows.

1. Floor plan setup: Users can work with the built-in showcase office or import a DXF floor plan. The editor displays walls, windows, rooms, seats, and contextual overlays.

2. Employee modeling: Users create employee profiles with work style, activity type, health considerations, and preferred ranges for temperature, lighting, noise, air quality, and humidity.

3. Comfort diagnosis: For each assigned employee, the app estimates current seat conditions and highlights gaps between the environment and that person's preferences.

4. Intervention comparison: Users can test improvements such as better glazing, acoustic partitions, ventilation changes, lighting support, and seat redistribution. The app compares before-and-after comfort scores for each employee and for the whole plan.

## How It Works

### Floor Plan Geometry

The planner stores walls, windows, rooms, zones, and seats as structured geometry. Each seat is evaluated against nearby windows, exterior walls, interior partitions, and surrounding occupancy. This geometry drives the environmental estimates used throughout the app.

### Environmental Estimation

For each seat, the app estimates:

- Temperature, based on city climate, season, time of day, exterior wall proximity, orientation, solar exposure, and glazing type.
- Illuminance, based on distance to windows, orientation, visible light transmittance, and time-of-day sunlight.
- Noise, based on seat location, office occupancy, and nearby interior/acoustic partitions.
- CO2, based on base city profile, occupancy timing, and distance from ventilation/window proxies.
- Humidity, based on selected city climate.

The model is transparent and fast. It is built for comparative design decisions: it shows which options are likely to improve comfort and where the largest problems are located.

### Employee Preference Matching

Employee profiles define preferred ranges and tolerances. The app compares each seat's estimated conditions with the employee's preferences, then produces a comfort match score. Health considerations adjust preferences so the recommendations reflect real workplace needs such as heat sensitivity, migraines, asthma, eye strain, back pain, or cold sensitivity.

### Recommendation Engine

The recommendation engine groups detected issues by domain:

- Thermal comfort: glazing upgrades, shading, or seat moves away from hot facades.
- Lighting comfort: task lighting, glare control, or better daylight balance.
- Acoustic comfort: partitions, absorption, or seat moves away from noisy open areas.
- Air quality: ventilation improvements and better air distribution.
- Spatial fit: seating decisions aligned to work style and activity patterns.

Recommendations are shown at both employee level and plan level, so a designer can move from individual pain points to broader interventions.

### Scenario Comparison

The comparison view evaluates a current plan against an adjusted plan. It calculates before-and-after comfort scores for assigned employees and summarizes total improvement, number of employees improved, and per-employee score changes.

## Product Experience

The interface is a focused planning dashboard with four main tabs:

- Plan: Edit/import a floor plan, assign seats, and manage employee profiles.
- Diagnosis: Review employee-specific comfort gaps.
- Generation: Produce a design intervention card for the current scenario.
- Comparison: Compare before-and-after design interventions.

The app uses an English-only interface, a fixed light theme, and a concise city selector built around climate variety.

## Use Case Case Studies

### Case Study 1: Hot Facade Seating In Riyadh

Scenario: A team is planning an office in a hot dry climate. Several employees sit close to south and west exterior walls with single glazing.

Workflow:

1. Select `Riyadh`.
2. Assign heat-sensitive employees to existing seats near the exterior facade.
3. Open Diagnosis to identify high-temperature gaps.
4. Open Comparison and test Low-E glazing plus seat redistribution.

Outcome: The planner shows which employees benefit from glazing upgrades and which still need seat moves. The team can separate building-envelope improvements from low-cost layout changes.

### Case Study 2: Humidity And Air Comfort In Singapore

Scenario: A dense workplace in a hot humid climate has employees reporting fatigue and discomfort during peak occupancy.

Workflow:

1. Select `Singapore`.
2. Assign employees with asthma or air sensitivity.
3. Review CO2 and humidity readings in Diagnosis.
4. Generate an intervention card focused on ventilation and air distribution.

Outcome: The app highlights air quality pressure and shows whether ventilation changes improve comfort enough or whether seating changes are also needed.

### Case Study 3: Cold Climate Planning In Helsinki

Scenario: A company is planning a quiet focused-work area in a cold climate. Some employees are cold-sensitive and prefer warmer seats with low noise.

Workflow:

1. Select `Helsinki`.
2. Create cold-sensitive and focus-work profiles.
3. Assign employees across perimeter and interior seats.
4. Use Diagnosis to find temperature and acoustic fit.

Outcome: The planner helps place cold-sensitive employees away from colder perimeter conditions and identify seats that better support focus work.

### Case Study 4: High-Altitude Office In Abha

Scenario: A design team wants to evaluate seating in a high-altitude city with milder temperatures and different comfort pressures from lowland hot cities.

Workflow:

1. Select `Abha`.
2. Assign employees with varied lighting and noise preferences.
3. Compare seating near windows against deeper-plan seats.
4. Use the generated intervention card to prioritize daylight and acoustic changes.

Outcome: The app shifts attention away from pure heat control and toward balanced lighting, glare, and acoustic zoning.

### Case Study 5: Dense Urban Air In Delhi

Scenario: A workplace in a dense urban context needs stronger air-quality planning and clearer seating strategies for employees with respiratory sensitivity.

Workflow:

1. Select `Delhi`.
2. Add employees with asthma or high ventilation preference.
3. Assign seats across the plan.
4. Compare the current plan with ventilation improvements.

Outcome: The planner identifies employees most affected by air quality assumptions and helps justify targeted ventilation upgrades near occupied areas.

## Implementation Notes

The frontend is built with React, TypeScript, Vite, and Tailwind CSS. Environmental calculations and profile matching live in TypeScript modules under `client/src/lib`. The Python service improves DXF conversion when available, while the browser fallback keeps the import workflow usable without a running backend service.

The project includes focused tests for the default floor plan and city climate coverage. These tests make sure sample employees remain assigned to showcase seats and every visible city option maps to a real climate profile.

## Future Improvements

- Add project save/load for full planning sessions.
- Add CSV employee import for larger teams.
- Add richer weather presets or optional live weather integration.
- Add visual heat, light, noise, and air quality overlays on the floor plan.
- Add exportable intervention reports for stakeholder review.
