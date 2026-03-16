🧠 Learning Bot — Personal Behavioral AI & MLOps Platform

Learning Bot is an event-driven behavioral analytics and machine learning platform designed to transform daily activity logs into structured datasets, behavioral state vectors, and predictive insights.

The system collects events through Telegram, processes them through an automated data engineering and ML pipeline, and generates insights about productivity, learning habits, and behavior patterns.

This project serves as both:

a personal AI experimentation platform

a full-stack MLOps learning project

a behavioral analytics research system

🚀 System Overview

Learning Bot converts unstructured life events into machine learning features and behavior state vectors that can be analyzed and modeled.

Example user input:

Studied Kubernetes for 2 hours
Gym 45 minutes
Spent 500 groceries
Watched ML lecture 30 minutes

The system converts these messages into structured behavioral data and predictions.

🏗️ High-Level Architecture
Telegram Messages
        │
        ▼
Event Ingestion Layer
        │
        ▼
Raw Event Dataset
        │
        ▼
Feature Engineering
        │
        ▼
Behavior State Vector (BSV)
        │
        ▼
Machine Learning Models
        │
        ▼
Prediction Engine
        │
        ▼
Analytics & Dashboard
⚙️ Technology Stack
Infrastructure

Telegram Bot API

Cloudflare Workers

Cloudflare KV

GitHub Actions (pipeline automation)

Data Stack

CSV (raw events)

Parquet (analytics datasets)

Pandas

PyArrow

Machine Learning

Scikit-learn

RandomForestRegressor

Feature engineering pipelines

Automation

Event-driven GitHub workflows

Repository dispatch triggers

Scheduled pipelines

📂 Repository Structure
learning-bot/

analytics/
   dashboard.md
   heatmap.md
   weekly-summary.md

data/
   raw/
      events.csv
   features/
      behavior_features.parquet
      daily_behavior.parquet

models/
   productivity_model.pkl

scripts/

   ingestion/
      nlp_parser.py

   features/
      feature_extractor.py
      state_vector_builder.py

   ml/
      train_models.py
      predict.py

   analytics/
      analytics.py

   pipeline/
      run_pipeline.py

.github/workflows/

   ingest.yml
   features.yml
   ml_training.yml
   analytics.yml
   update_dataset.yml
📡 Event Ingestion Layer

User events are captured through Telegram messages.

The Telegram bot sends messages to a Cloudflare Worker, which:

receives webhook events

stores messages in a queue

batches events

triggers a GitHub ingestion pipeline

Pipeline trigger:

repository_dispatch
event_type: telegram_batch
🗂️ Raw Event Dataset

Events are stored in:

data/raw/events.csv

Schema:

Column	Description
timestamp	event timestamp
user	user identifier
text	raw message
category	classified event type
topic	detected topic
source	event source

Example record:

timestamp,user,text,category,topic,source
2026-03-16T10:21:00Z,avi,Studied Kubernetes for 2 hours,learning,kubernetes,telegram
🧩 Feature Engineering Layer

Script:

scripts/features/feature_extractor.py

This stage converts natural language events into structured behavioral signals.

Example transformation:

Input event:

Studied Kubernetes for 2 hours

Extracted features:

study_minutes = 120
topic = kubernetes
category = learning

Generated dataset:

data/features/behavior_features.parquet
📊 Behavior State Vector (BSV)

Script:

scripts/features/state_vector_builder.py

The BSV layer aggregates event-level features into daily behavioral summaries.

Example:

Raw events:

Study 120 minutes
Exercise 45 minutes
Spent 500

Behavior state vector:

date,study_minutes,exercise_minutes,expense_amount
2026-03-16,150,45,500

Output dataset:

data/features/daily_behavior.parquet

This dataset is used for machine learning training.

🤖 Machine Learning Layer

Script:

scripts/ml/train_models.py

Model inputs:

study_minutes
exercise_minutes
expense_amount

Target variable (experimental productivity score):

productivity =
0.6 * study_minutes +
0.3 * exercise_minutes -
0.01 * expenses

Model used:

RandomForestRegressor

Trained model artifact:

models/productivity_model.pkl
🔮 Prediction Engine

Script:

scripts/ml/predict.py

Responsibilities:

load trained model

read latest behavior state vector

generate predictions

Example output:

Predicted productivity: 82%
📈 Analytics Layer

Script:

scripts/analytics/analytics.py

Generates behavioral insights including:

study time distribution

exercise vs productivity

spending patterns

learning topics

Outputs:

analytics/dashboard.md
analytics/heatmap.md
analytics/weekly-summary.md
🔄 Automated Pipelines

The system uses GitHub Actions workflows to automate the entire pipeline.

Workflow	Purpose
ingest.yml	Telegram event ingestion
features.yml	feature engineering
ml_training.yml	ML model training
analytics.yml	analytics generation
update_dataset.yml	dataset maintenance
🔁 End-to-End Pipeline
Telegram Message
        ↓
Cloudflare Worker
        ↓
GitHub repository_dispatch
        ↓
Ingestion Pipeline
        ↓
events.csv
        ↓
Feature Extraction
        ↓
behavior_features.parquet
        ↓
State Vector Builder
        ↓
daily_behavior.parquet
        ↓
ML Training
        ↓
productivity_model.pkl
        ↓
Prediction Engine
        ↓
Analytics Reports
        ↓
Dashboard
🎯 Project Goals

This project explores:

behavioral analytics

habit tracking systems

productivity modeling

event-driven ML pipelines

personal AI assistants

🔮 Future Enhancements

Planned improvements include:

vector memory using embeddings

semantic event classification

reinforcement learning for habit optimization

predictive behavior modeling

AI assistant integration

📚 Learning Outcomes

This project demonstrates practical experience in:

MLOps pipeline design

data engineering workflows

behavioral analytics

machine learning experimentation

event-driven system architecture