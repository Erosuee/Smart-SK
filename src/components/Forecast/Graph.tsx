import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  Divider
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './Forecast.css';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ForecastDataType {
  ds?: string[];
  yhat?: number[];
  yhat_upper?: number[];
  yhat_lower?: number[];
  historical_acceptance?: any[];
  forecast_acceptance?: any[];
  error?: boolean;
  message?: string;
}

interface FilterOptions {
  category: string;
  subCategory: string;
  budget: string;
  duration: string;
  startDate: dayjs.Dayjs | null;
  endDate: dayjs.Dayjs | null;
}

// Add after your interfaces but before the component definition
const categoryOptions = {
  all: 'All Categories',
  training: 'Training',
  sportsEvents: 'Sports Events',
  feedingProgram: 'Feeding Program',
  scholarships: 'Scholarships',
  artsCulture: 'Arts & Culture',
  other: 'Other'
};

const subCategoryOptions: Record<string, Array<{value: string, label: string}>> = {
  all: [{ value: 'all', label: 'All Sub Categories' }],
  training: [
    { value: 'all', label: 'All Training Types' },
    { value: 'leadership', label: 'Leadership Training' },
    { value: 'professionalism', label: 'Professionalism Training' },
    { value: 'technology', label: 'Technology Training' },
    { value: 'health', label: 'Health Training' },
    { value: 'artsCulture', label: 'Arts & Culture Training' },
    { value: 'education', label: 'Education Training' },
    { value: 'healthSafety', label: 'Health & Safety Training' },
    { value: 'agriculture', label: 'Agriculture Training' },
    { value: 'environment', label: 'Environment Training' },
    { value: 'combined', label: 'Combined Training' }
  ],
  sportsEvents: [
    { value: 'all', label: 'All Sports Events' },
    { value: 'specific', label: 'Specific Sport (e.g., Basketball, Soccer, Marathon)' },
    { value: 'team', label: 'Team Sports' },
    { value: 'individual', label: 'Individual Sports' },
    { value: 'endurance', label: 'Endurance Events' }
  ],
  feedingProgram: [
    { value: 'all', label: 'All Feeding Programs' },
    { value: 'children', label: 'Children\'s Feeding Program' },
    { value: 'student', label: 'Student Feeding Program' },
    { value: 'community', label: 'Community Feeding Program' },
    { value: 'nutritional', label: 'Nutritional Support Program' },
    { value: 'emergency', label: 'Emergency Food Relief' }
  ],
  scholarships: [
    { value: 'all', label: 'All Scholarships' },
    { value: 'academic', label: 'Academic Scholarship' },
    { value: 'artsCulture', label: 'Arts & Culture Scholarship' },
    { value: 'sports', label: 'Sports Scholarship' },
    { value: 'technical', label: 'Technical/Vocational Scholarship' },
    { value: 'general', label: 'General Scholarship' }
  ],
  artsCulture: [
    { value: 'all', label: 'All Arts & Culture' },
    { value: 'performing', label: 'Performing Arts (e.g., Theater, Dance, Music)' },
    { value: 'visual', label: 'Visual Arts (e.g., Painting, Sculpture, Photography)' },
    { value: 'literary', label: 'Literary Arts' },
    { value: 'cultural', label: 'Cultural Heritage' },
    { value: 'media', label: 'Media Arts (e.g., Film, Digital Media)' }
  ],
  other: [
    { value: 'all', label: 'All Other Types' }
  ]
};

interface GraphProps {
  onFiltersChange?: (filters: FilterOptions) => void;
}

const Graph: React.FC<GraphProps> = ({ onFiltersChange }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<ForecastDataType | null>(null);
  const [normalizedForecastData, setNormalizedForecastData] = useState<ForecastDataType | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    category: 'all',
    subCategory: 'all',
    budget: 'all',
    duration: 'all',
    startDate: null,
    endDate: null
  });

  // Process the data for chart display
  const chartData = normalizedForecastData && !normalizedForecastData.error && 
                   normalizedForecastData.ds && normalizedForecastData.ds.length > 0 ? {
    // Transform the API data to chart format
    labels: normalizedForecastData.ds,
    datasets: [
      // Add confidence interval fill area
      ...(normalizedForecastData.yhat_upper && normalizedForecastData.yhat_lower ? [{
        label: 'Confidence Interval',
        data: normalizedForecastData.yhat_lower,
        borderColor: 'transparent',
        backgroundColor: 'rgba(75, 192, 192, 0.15)',
        fill: {
          target: '+1',
          above: 'rgba(75, 192, 192, 0.15)'
        },
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.3,
        order: 1
      }] : []),
      {
        label: 'Forecast',
        data: normalizedForecastData.yhat || [],
        borderColor: 'rgb(29, 162, 216)',
        backgroundColor: 'rgba(29, 162, 216, 0.1)',
        tension: 0.3,
        borderWidth: 4,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2,
        pointBorderColor: 'rgb(29, 162, 216)',
        order: 0,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.1)'
      },
      ...(normalizedForecastData.yhat_upper ? [{
        label: 'Upper Bound',
        data: normalizedForecastData.yhat_upper,
        borderColor: 'rgba(29, 162, 216, 0.6)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 2
      }] : []),
      ...(normalizedForecastData.yhat_lower ? [{
        label: 'Lower Bound',
        data: normalizedForecastData.yhat_lower,
        borderColor: 'rgba(29, 162, 216, 0.6)', 
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 2
      }] : [])
    ],
  } : null;

  // Fetch forecast data from backend with filters
  const fetchForecastData = async (filterOptions: FilterOptions = filters) => {
    try {
      setLoading(true);
      setError(null);
      setApiErrorMessage(null);
      
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      
      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      if (filterOptions.category !== 'all') queryParams.append('category', filterOptions.category);
      // Removed subCategory parameter
      if (filterOptions.budget !== 'all') queryParams.append('budget', filterOptions.budget);
      // Removed duration parameter
      
      // Handle date conversion safely
      if (filterOptions.startDate) {
        try {
          queryParams.append('startDate', filterOptions.startDate.format('YYYY-MM-DD'));
        } catch (e) {
          console.error('Error formatting start date:', e);
        }
      }
      
      if (filterOptions.endDate) {
        try {
          queryParams.append('endDate', filterOptions.endDate.format('YYYY-MM-DD'));
        } catch (e) {
          console.error('Error formatting end date:', e);
        }
      }
      
      // Add a timestamp to prevent caching issues
      queryParams.append('_t', Date.now().toString());
      
      // Construct URL with query parameters
      const url = `http://localhost:3000/api/forecast${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      console.log('Fetching forecast with URL:', url);
      
      // Try to connect to the backend server - REMOVE the Cache-Control header
      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', errorText);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Parse the response as JSON
      const data = await response.json();
      
      // Check if the response contains an error
      if (data && data.error) {
        console.error('API returned error:', data.message);
        setApiErrorMessage(data.message || 'Failed to generate forecast data');
        setForecastData(data);
      } else {
        setForecastData(data);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error fetching forecast data:', error);
      setError('Failed to connect to forecast API. Please try again later.');
      // Don't set default data, just show the error
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch only
  useEffect(() => {
    fetchForecastData();
  }, []); // Empty dependency array means this runs once on mount
  
  // Handle filter changes
  const handleFilterChange = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    
    // Simplified - no need to reset subCategory since it's removed from UI
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle date changes - simplified to avoid state update conflicts
  const handleDateChange = (name: string, date: dayjs.Dayjs | null) => {
    setFilters(prev => ({
      ...prev,
      [name]: date
    }));
  };

  // Apply filters - update to notify parent component
  const applyFilters = () => {
    setLoading(true);
    fetchForecastData(filters);
    
    // Notify parent component of filter changes if callback exists
    if (onFiltersChange) {
      onFiltersChange(filters);
    }
  };

  // Normalization effect
  useEffect(() => {
    if (forecastData) {
      // Check if there's an error
      if (forecastData.error) {
        setNormalizedForecastData(forecastData);
        return;
      }
      
      // Create a copy to avoid modifying the original data
      const normalizedData = { ...forecastData };
      
      // Only normalize if we have data
      if (normalizedData.ds && normalizedData.ds.length > 0) {
        // Your normalization logic here
        // If we have category or subcategory filters, scale down the forecast
        if (filters.category !== 'all' || filters.subCategory !== 'all') {
          // Calculate a scaling factor based on the category
          let scalingFactor = 1.0;
          
          // Different categories should have different scaling factors
          if (filters.category === 'training') scalingFactor = 0.3;
          else if (filters.category === 'sportsEvents') scalingFactor = 0.25;
          else if (filters.category === 'feedingProgram') scalingFactor = 0.2;
          else if (filters.category === 'scholarships') scalingFactor = 0.15;
          else if (filters.category === 'artsCulture') scalingFactor = 0.2;
          else if (filters.category === 'other') scalingFactor = 0.1;
          
          // Further adjust if subcategory is selected
          if (filters.subCategory !== 'all') {
            scalingFactor *= 0.5; // Subcategories should have fewer projects
          }
          
          // Apply scaling to the forecast values
          if (normalizedData.yhat) {
            normalizedData.yhat = normalizedData.yhat.map(val => val * scalingFactor);
          }
          if (normalizedData.yhat_upper) {
            normalizedData.yhat_upper = normalizedData.yhat_upper.map(val => val * scalingFactor);
          }
          if (normalizedData.yhat_lower) {
            normalizedData.yhat_lower = normalizedData.yhat_lower.map(val => val * scalingFactor);
          }
        }
      }
      
      setNormalizedForecastData(normalizedData);
    }
  }, [forecastData]); // Remove filters.category and filters.subCategory from dependencies

  // Add options to scale the y-axis appropriately
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 14,
            family: "'Roboto', 'Helvetica', 'Arial', sans-serif"
          },
          usePointStyle: true,
          padding: 20,
          color: '#333'
        },
        align: 'center' as const,
      },
      title: {
        display: true,
        text: 'Project Volume Forecast',
        font: {
          size: 20,
          family: "'Roboto', 'Helvetica', 'Arial', sans-serif",
          weight: 'bold'
        },
        color: '#333',
        padding: {
          top: 20,
          bottom: 30
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 16,
          family: "'Roboto', 'Helvetica', 'Arial', sans-serif"
        },
        bodyFont: {
          size: 14,
          family: "'Roboto', 'Helvetica', 'Arial', sans-serif"
        },
        padding: 12,
        cornerRadius: 6,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += Math.round(context.parsed.y * 100) / 100;
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Projects',
          font: {
            size: 16,
            family: "'Roboto', 'Helvetica', 'Arial', sans-serif",
            weight: 'bold'
          },
          color: '#555',
          padding: {
            bottom: 20
          }
        },
        ticks: {
          font: {
            size: 12,
            family: "'Roboto', 'Helvetica', 'Arial', sans-serif"
          },
          padding: 10,
          color: '#666'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.07)',
          drawBorder: false
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 16,
            family: "'Roboto', 'Helvetica', 'Arial', sans-serif",
            weight: 'bold'
          },
          color: '#555',
          padding: {
            top: 20
          }
        },
        ticks: {
          font: {
            size: 12,
            family: "'Roboto', 'Helvetica', 'Arial', sans-serif"
          },
          maxRotation: 45,
          minRotation: 45,
          padding: 10,
          color: '#666',
          autoSkip: true,
          maxTicksLimit: 15
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.04)',
          drawBorder: false
        }
      }
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 6,
        hitRadius: 30,
        borderWidth: 2
      },
      line: {
        tension: 0.3,
        borderWidth: 3,
        fill: false
      }
    },
    animation: {
      duration: 1500
    },
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    layout: {
      padding: {
        top: 10,
        right: 20,
        bottom: 10,
        left: 10
      }
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {/* Filter Controls */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Customize Forecast
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Row for filter controls */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: { xs: '100%', sm: '23%' } }}>
              <FormControl fullWidth>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  id="category"
                  name="category"
                  value={filters.category}
                  label="Category"
                  onChange={handleFilterChange}
                >
                  {Object.entries(categoryOptions).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ width: { xs: '100%', sm: '23%' } }}>
              <FormControl fullWidth>
                <InputLabel id="budget-label">Budget Range</InputLabel>
                <Select
                  labelId="budget-label"
                  id="budget"
                  name="budget"
                  value={filters.budget}
                  label="Budget Range"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">All Budget Ranges</MenuItem>
                  <MenuItem value="range1">₱105,600 - ₱130,000</MenuItem>
                  <MenuItem value="range2">₱81,200 - ₱105,599</MenuItem>
                  <MenuItem value="range3">₱56,800 - ₱81,199</MenuItem>
                  <MenuItem value="range4">₱32,400 - ₱56,799</MenuItem>
                  <MenuItem value="range5">₱8,000 - ₱32,399</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ width: { xs: '100%', sm: '23%' } }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => handleDateChange('startDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>
            
            <Box sx={{ width: { xs: '100%', sm: '23%' } }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => handleDateChange('endDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Box>
          </Box>
          
          {/* Apply Filter Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              variant="contained" 
              onClick={applyFilters}
              disabled={loading}
            >
              Apply Filters
            </Button>
          </Box>
        </Box>
      </Paper>
      
      {/* Chart */}
      <Paper elevation={4} className="chart-paper" sx={{ mb: 4 }}>
        <Box p={4}>
          <Typography variant="h5" component="h2" gutterBottom className="chart-title">
            Project Volume Forecast
          </Typography>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="500px">
              <CircularProgress />
            </Box>
          ) : apiErrorMessage ? (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
              <WarningAmberIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom align="center">
                Forecast Data Temporarily Unavailable
              </Typography>
              <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 600, mb: 2 }}>
                {apiErrorMessage}
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
                Please try again later or contact system administrator for assistance.
              </Typography>
            </Box>
          ) : !chartData ? (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
              <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Forecast Data Available
              </Typography>
              <Typography variant="body1" color="text.secondary" align="center">
                Unable to generate forecast with the current filters. Please try different filter options.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
              <Box className="chart-container" height="550px">
                <Line data={chartData} options={options} />
              </Box>
              <Box mt={3} p={2} bgcolor="rgba(240, 248, 255, 0.6)" borderRadius={2}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Note:</strong> This forecast shows projected SK project volume trends for District 5, Quezon City.
                  The confidence interval (shaded area) indicates the range of possible values based on historical data analysis.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </div>
  );
};

export default Graph;