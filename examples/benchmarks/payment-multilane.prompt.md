# Payment Multilane Benchmark

Create an editable Excalidraw service-flow diagram for a payment approval system.

Include:

- Web App
- API Gateway
- Payment Service
- Fraud Check
- Payment DB
- Payment Events topic
- Settlement Worker
- External Card Network

The main request path should be visually obvious:

Web App → API Gateway → Payment Service → External Card Network

Supporting concerns should not interrupt the main path:

- Fraud Check stays near Payment Service
- Payment DB stays below Payment Service
- Payment Events and Settlement Worker form a separate async support flow

Use professional-software style, semantic ids, concise labels, and an editable `.excalidraw` output.
