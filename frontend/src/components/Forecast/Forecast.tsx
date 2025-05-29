import React, { useState } from 'react';
import Layout from '../Layout/Layout';
import Graph from './Graph';
import Response from './Response';
import Trends from './Trends';
import { Container, Typography } from '@mui/material';
import './Forecast.css';
import dayjs from 'dayjs';

// Graph component filter options
interface GraphFilterOptions {
  category: string;
  subCategory: string;
  budget: string;
  duration: string;
  startDate: dayjs.Dayjs | null;
  endDate: dayjs.Dayjs | null;
}

// Response component filter options
interface ResponseFilterOptions {
  category?: string;
  budget?: string;
  startDate?: string;
  endDate?: string;
}

const Forecast: React.FC = () => {
  const [activeTab, setActiveTab] = useState('forecastGraph');
  // Add shared filter state for Graph
  const [filters, setFilters] = useState<GraphFilterOptions>({
    category: 'all',
    subCategory: 'all',
    budget: 'all',
    duration: 'all',
    startDate: null,
    endDate: null
  });

  // Add handler for filter changes
  const handleFiltersChange = (newFilters: GraphFilterOptions) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
  };
  
  // Convert GraphFilterOptions to ResponseFilterOptions
  const getResponseFilters = (): ResponseFilterOptions => {
    return {
      category: filters.category !== 'all' ? filters.category : undefined,
      budget: filters.budget !== 'all' ? filters.budget : undefined,
      startDate: filters.startDate ? filters.startDate.format('YYYY-MM-DD') : undefined,
      endDate: filters.endDate ? filters.endDate.format('YYYY-MM-DD') : undefined
    };
  };

  return (
    <Layout>
      <Container maxWidth="lg" className="forecast-container">
        <Typography variant="h4" component="h1" gutterBottom className="forecast-title">
          Project Forecasting
        </Typography>
        
        <div className="forecast-tabs">
          <button 
            className={activeTab === 'forecastGraph' ? 'active' : ''} 
            onClick={() => setActiveTab('forecastGraph')}
          >
            Forecast Graph
          </button>
          
          <button 
            className={activeTab === 'forecastReview' ? 'active' : ''} 
            onClick={() => setActiveTab('forecastReview')}
          >
            Forecast Trends
          </button>
        </div>
        
        <div className="forecast-content">
          {activeTab === 'forecastGraph' && (
            <>
              <Graph onFiltersChange={handleFiltersChange} />
              <Response filters={getResponseFilters()} />
            </>
          )}
          {activeTab === 'forecastReview' && (
            <Trends filters={getResponseFilters()} />
          )}
        </div>
      </Container>
    </Layout>
  );
};

export default Forecast;
