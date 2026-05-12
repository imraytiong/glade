---
Sdfasdf: asdf
Asdf: Asdf
aasdfasdf: asdf
foo: ""
new_property_5: ""
new_property_6: ""
---
# Comprehensive Codeblock Formatting Test

This document contains test blocks for various programming languages to ensure the Prism syntax highlighter correctly identifies and styles different token types across a wide range of syntaxess. 

<br />

Hello!!!

<br />

## JavaScript

```javascript
/**
 * A basic caching mechanism using a Map.
 * Demonstrates classes, methods, promises, and async/await.
 */
class DataCache {
  constructor(maxSize = 100, ttl = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  async fetchWithCache(key, fetchFunction) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (Date.now() - entry.timestamp < this.ttl) {
        console.log(`[Cache Hit] ${key}`);
        return entry.data;
      } else {
        console.log(`[Cache Expired] ${key}`);
        this.cache.delete(key);
      }
    }

    console.log(`[Cache Miss] Fetching ${key}...`);
    try {
      const data = await fetchFunction();
      this.set(key, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch data for ${key}:`, error);
      throw error;
    }
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (first item in Map iteration)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

// Example usage
const userCache = new DataCache(50, 120000); // 2 minutes TTL
```

## TypeScript

```typescript
import { useState, useEffect, useCallback } from 'react';

/**
 * A custom React hook for managing debounced state.
 * Useful for search inputs to prevent excessive API calls.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    () => {
      // Update debounced value after delay
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      // Cancel the timeout if value changes (also on delay change or unmount)
      // This is how we prevent debounced value from updating if value is changed ...
      // .. within the delay period. Timeout gets cleared and restarted.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Only re-call effect if value or delay changes
  );

  return debouncedValue;
}

// Example Component using the hook
export interface SearchProps {
  onSearch: (query: string) => Promise<void>;
}

export const SearchBar: React.FC<SearchProps> = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      onSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, onSearch]);

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  );
};
```

## Python

```python
import asyncio
import aiohttp
from typing import List, Dict, Any
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class APIResponse:
    url: str
    status: int
    data: Dict[str, Any]

class AsyncDataFetcher:
    """
    A class to asynchronously fetch data from multiple URLs concurrently.
    Demonstrates async/await, list comprehensions, and type hinting.
    """
    def __init__(self, timeout: int = 10):
        self.timeout = aiohttp.ClientTimeout(total=timeout)

    async def _fetch_single(self, session: aiohttp.ClientSession, url: str) -> APIResponse:
        logger.info(f"Fetching {url}...")
        try:
            async with session.get(url) as response:
                status = response.status
                data = await response.json() if status == 200 else {}
                return APIResponse(url=url, status=status, data=data)
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return APIResponse(url=url, status=500, data={"error": str(e)})

    async def fetch_all(self, urls: List[str]) -> List[APIResponse]:
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            tasks = [self._fetch_single(session, url) for url in urls]
            # Run all tasks concurrently
            results = await asyncio.gather(*tasks)
            return list(results)

async def main():
    urls_to_fetch = [
        "https://jsonplaceholder.typicode.com/posts/1",
        "https://jsonplaceholder.typicode.com/posts/2",
        "https://jsonplaceholder.typicode.com/posts/3"
    ]
    
    fetcher = AsyncDataFetcher()
    results = await fetcher.fetch_all(urls_to_fetch)
    
    for res in results:
        print(f"URL: {res.url} | Status: {res.status}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Rust

```rust
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::path::Path;

/// Represents a simple directed graph using an adjacency list.
#[derive(Debug, Default)]
pub struct Graph {
    nodes: HashMap<String, Vec<String>>,
}

impl Graph {
    /// Creates a new, empty graph.
    pub fn new() -> Self {
        Graph {
            nodes: HashMap::new(),
        }
    }

    /// Adds a directed edge from `src` to `dst`.
    pub fn add_edge(&mut self, src: &str, dst: &str) {
        self.nodes
            .entry(src.to_string())
            .or_insert_with(Vec::new)
            .push(dst.to_string());
            
        // Ensure destination node exists in the map
        self.nodes.entry(dst.to_string()).or_insert_with(Vec::new);
    }

    /// Parses a simple edge list file where each line is "src dst".
    pub fn from_file<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut graph = Graph::new();

        for line in reader.lines() {
            let line = line?;
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                graph.add_edge(parts[0], parts[1]);
            }
        }

        Ok(graph)
    }

    /// Returns the number of nodes in the graph.
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }
}

fn main() {
    let mut g = Graph::new();
    g.add_edge("A", "B");
    g.add_edge("B", "C");
    g.add_edge("A", "C");
    
    println!("Graph has {} nodes.", g.node_count());
    println!("{:#?}", g);
}
```

## Go

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// TaskStatus represents the current state of a background job
type TaskStatus string

const (
	StatusPending    TaskStatus = "pending"
	StatusProcessing TaskStatus = "processing"
	StatusCompleted  TaskStatus = "completed"
	StatusFailed     TaskStatus = "failed"
)

// Job represents an asynchronous task
type Job struct {
	ID        string     `json:"id"`
	Payload   string     `json:"payload"`
	Status    TaskStatus `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
}

// JobQueue manages processing of jobs concurrently
type JobQueue struct {
	jobs    map[string]*Job
	mu      sync.RWMutex
	workers int
	queue   chan *Job
}

func NewJobQueue(workers int, bufferSize int) *JobQueue {
	return &JobQueue{
		jobs:    make(map[string]*Job),
		workers: workers,
		queue:   make(chan *Job, bufferSize),
	}
}

func (jq *JobQueue) Start(ctx context.Context) {
	for i := 0; i < jq.workers; i++ {
		go jq.worker(ctx, i)
	}
}

func (jq *JobQueue) worker(ctx context.Context, id int) {
	for {
		select {
		case <-ctx.Done():
			log.Printf("Worker %d shutting down", id)
			return
		case job := <-jq.queue:
			jq.mu.Lock()
			job.Status = StatusProcessing
			jq.mu.Unlock()

			// Simulate work
			time.Sleep(2 * time.Second)

			jq.mu.Lock()
			job.Status = StatusCompleted
			jq.mu.Unlock()
			log.Printf("Worker %d completed job %s", id, job.ID)
		}
	}
}

func main() {
	q := NewJobQueue(3, 100)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	q.Start(ctx)
    
	fmt.Println("Job queue started. Waiting for context to cancel...")
	<-ctx.Done()
}
```

## C++

```cpp
#include <iostream>
#include <vector>
#include <memory>
#include <string>
#include <algorithm>

// Abstract base class
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual std::string name() const = 0;
};

// Derived class: Circle
class Circle : public Shape {
private:
    double radius;
public:
    Circle(double r) : radius(r) {}
    
    double area() const override {
        return 3.14159265359 * radius * radius;
    }
    
    std::string name() const override {
        return "Circle";
    }
};

// Derived class: Rectangle
class Rectangle : public Shape {
private:
    double width;
    double height;
public:
    Rectangle(double w, double h) : width(w), height(h) {}
    
    double area() const override {
        return width * height;
    }
    
    std::string name() const override {
        return "Rectangle";
    }
};

int main() {
    // Vector of unique pointers to Shapes
    std::vector<std::unique_ptr<Shape>> shapes;
    
    shapes.push_back(std::make_unique<Circle>(5.0));
    shapes.push_back(std::make_unique<Rectangle>(4.0, 6.0));
    shapes.push_back(std::make_unique<Circle>(2.5));

    // Sort shapes by area (descending)
    std::sort(shapes.begin(), shapes.end(), [](const std::unique_ptr<Shape>& a, const std::unique_ptr<Shape>& b) {
        return a->area() > b->area();
    });

    std::cout << "Shapes sorted by area (largest to smallest):\n";
    for (const auto& shape : shapes) {
        std::cout << shape->name() << " - Area: " << shape->area() << "\n";
    }

    return 0;
}
```

## CSS

```css
/* Modern Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary-color: #3490dc;
  --primary-hover: #2779bd;
  --text-base: #333333;
  --bg-color: #f8fafc;
  --radius: 8px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--text-base);
  background-color: var(--bg-color);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Card Component */
.card {
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: 1.5rem;
  margin: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.card-header {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

/* Button with Grid */
.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.btn {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  font-weight: 500;
  cursor: pointer;
  text-align: center;
}

.btn:active {
  transform: scale(0.98);
}

@media (max-width: 640px) {
  .card {
    margin: 0.5rem;
    padding: 1rem;
  }
}
```

## HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modern Dashboard</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="app-layout">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                <span>Acme Corp</span>
            </div>
            <nav class="nav-links">
                <a href="#dashboard" class="active">Dashboard</a>
                <a href="#analytics">Analytics</a>
                <a href="#users">Users</a>
                <a href="#settings">Settings</a>
            </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="content">
            <header class="topbar">
                <div class="search">
                    <input type="search" placeholder="Search data...">
                </div>
                <div class="user-profile">
                    <img src="avatar.jpg" alt="User Avatar" class="avatar">
                </div>
            </header>

            <section class="dashboard-grid">
                <!-- Stats Cards -->
                <article class="stat-card">
                    <h3>Total Revenue</h3>
                    <p class="value">$45,231.89</p>
                    <span class="trend positive">+20.1% from last month</span>
                </article>
                <article class="stat-card">
                    <h3>Active Users</h3>
                    <p class="value">+2350</p>
                    <span class="trend positive">+180 from last month</span>
                </article>

                <!-- Chart Placeholder -->
                <div class="chart-container span-2">
                    <canvas id="revenueChart"></canvas>
                </div>
            </section>
        </main>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

## SQL

```sql
-- Comprehensive SQL Schema and Query Example

-- 1. Create a users table with constraints
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Create a posts table with a foreign key
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    published_date TIMESTAMP WITH TIME ZONE,
    is_draft BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0
);

-- 3. Create an index for faster lookups
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_published_date ON posts(published_date) WHERE is_draft = FALSE;

-- 4. Complex Query: Get top authors by view count in the last 30 days
WITH author_stats AS (
    SELECT 
        u.user_id,
        u.username,
        COUNT(p.post_id) as total_posts,
        SUM(p.view_count) as total_views
    FROM 
        users u
    LEFT JOIN 
        posts p ON u.user_id = p.author_id
    WHERE 
        p.is_draft = FALSE 
        AND p.published_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY 
        u.user_id, u.username
)
SELECT 
    username,
    total_posts,
    COALESCE(total_views, 0) as views,
    CASE 
        WHEN total_views > 10000 THEN 'Gold'
        WHEN total_views > 5000 THEN 'Silver'
        ELSE 'Bronze'
    END as author_tier
FROM 
    author_stats
ORDER BY 
    total_views DESC
LIMIT 10;
```

```javascript
var x
```

