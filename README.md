# 🌱 SMART-SOJA

> **An Autonomous IoT-Based Mobile Soybean Pre-processing System**

SMART-SOJA is an engineering project that aims to improve soybean post-harvest processing through an autonomous, mobile and connected pre-processing unit.

Designed for rural environments, the system combines embedded systems, industrial automation, IoT technologies and renewable energy to automate critical operations such as cleaning, moisture analysis, drying, weighing and digital traceability.

---

## 📖 Table of Contents

- Overview
- The Problem
- Objectives
- Key Features
- System Architecture
- Hardware Overview
- Software Architecture
- Technology Stack
- Repository Structure
- Roadmap
- Future Improvements
- Author
- License

---

# 📌 Overview

Soybean production is rapidly increasing across Africa, particularly in Benin. However, post-harvest losses caused by inadequate cleaning, excessive moisture and poor traceability continue to reduce product quality and market value.

SMART-SOJA addresses these challenges by providing a mobile cyber-physical system capable of:

- Cleaning soybean grains
- Measuring moisture content
- Performing intelligent drying cycles
- Weighing processed batches
- Recording production data
- Synchronizing traceability data through MQTT

The project integrates mechanical engineering, embedded electronics, industrial automation and cloud connectivity into a single modular platform.

---

# ❗ The Problem

Smallholder farmers often face several challenges:

- High post-harvest losses
- Non-uniform drying
- Manual quality control
- Lack of digital traceability
- Limited access to electricity

SMART-SOJA was designed to provide an affordable and intelligent solution adapted to rural environments.

---

# 🎯 Objectives

The project aims to:

- automate soybean pre-processing;
- improve grain quality before storage;
- reduce moisture-related losses;
- provide digital traceability;
- operate autonomously using solar energy;
- support smart agriculture initiatives.

---

# ✨ Key Features

- 🌱 Autonomous mobile platform
- 📡 IoT connectivity using MQTT
- ⚙️ Embedded control with ESP32
- ☀️ Solar-powered operation
- 💧 Dual moisture sensing
- 🔥 Intelligent drying control
- ⚖️ Integrated weighing system
- 💾 Offline data logging (MicroSD)
- ☁️ Cloud synchronization
- 📊 Real-time monitoring
- 🧠 FreeRTOS multitasking architecture
- 🔄 GRAFCET-based sequential control

---

# 🏗️ System Architecture

SMART-SOJA is composed of six major subsystems:

## Mechanical System

- Modular chassis
- Cleaning mechanism
- Drying chamber
- Weighing module
- Mobile structure

## Embedded Electronics

- ESP32 microcontroller
- Sensors
- Power electronics
- Human-Machine Interface

## Energy System

- Solar panel
- Battery
- Charging controller
- DC converters

## Control System

- FreeRTOS scheduler
- GRAFCET automation
- Safety management

## IoT Layer

- MQTT communication
- JSON data exchange
- Cloud synchronization
- Store-and-Forward mechanism

## Traceability Layer

- Batch identification
- Local storage
- Cloud database
- Digital production records

---

# ⚙️ Hardware Overview

Main components include:

- ESP32 DevKit
- Capacitive moisture sensors
- HX711 load cell module
- Servo motors
- DC geared motors
- MOSFET power drivers
- LCD I2C display
- MicroSD module
- Solar panel
- Battery system

---

# 💻 Software Architecture

The embedded firmware is based on FreeRTOS.

Main software modules:

- Safety Task
- Control Task
- Sensor Task
- Actuator Task
- LCD Task
- MQTT Task

The control logic is modeled using a two-level GRAFCET to ensure deterministic and reliable operation.

---

# 🛠️ Technology Stack

## Embedded

- ESP32
- FreeRTOS
- PlatformIO
- Arduino Framework

## IoT

- MQTT
- JSON
- Wi-Fi

## Mechanical

- SolidWorks

## Electronics

- KiCad

## Simulation

- Proteus
- Wokwi

---

# 📁 Repository Structure

```text
smart-soja/
│
├── docs/
├── firmware/
├── hardware/
├── mechanical/
├── cloud/
├── media/
└── research/
```

---

# 🚀 Project Roadmap

- [x] Problem identification
- [x] Requirements analysis
- [x] Mechanical design
- [x] Electronic architecture
- [x] Embedded software
- [x] Prototype implementation
- [x] Experimental validation

### Next Milestones

- [ ] PCB redesign
- [ ] Mobile application
- [ ] OTA firmware updates
- [ ] AI-assisted moisture prediction
- [ ] Industrial field testing
- [ ] Version 2 prototype

---

# 🌍 Future Vision

SMART-SOJA is envisioned as a scalable smart agriculture platform capable of supporting digital transformation in African agricultural value chains.

Future versions will integrate:

- Edge AI
- Predictive maintenance
- Computer vision
- Fleet management
- Remote diagnostics
- Industrial IoT deployment

---

# 👨‍💻 Author

**Dodji Virgile TCHIDEHOU**

Industrial Computing & Maintenance Engineer

Embedded Systems • IoT • Robotics • Intelligent Systems

---

# 📄 License

This project is licensed under the MIT License.
