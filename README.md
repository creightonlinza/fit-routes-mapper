# Fit Routes Mapper

The **Fit Routes Mapper** is an Angular standalone application designed to parse `.fit` files (commonly used in fitness tracking devices) and display the routes on a Google Map. The app allows users to upload `.fit` files, visualize parsed routes, and interact with route details.

## Features

- **Drag-and-Drop File Upload**: Easily upload `.fit` files by dragging and dropping them into the app.
- **Google Maps Integration**: Visualize routes on an interactive Google Map.
- **Route Parsing**: Parse `.fit` files to extract route data and display it with customizable options.
- **Activity Filtering**: Select specific activities (e.g., cycling, running) to include in the parsed data.
- **Route Color Modes**: Choose default, randomized, sport-based, or date-gradient route colors.
- **Progress Tracking**: Displays a progress bar while parsing files.
- **Import Summary**: Shows how many files loaded, were skipped, had no GPS data, failed decoding, failed reading, or were not `.fit` files.
- **Route Drawer**: Manage loaded routes with visibility, zoom, details, and delete controls.
- **Map Controls**: Switch map type and adjust global route width and opacity.
- **Visible Route Exports**: Export visible routes as GeoJSON or CSV.
- **Route Details Modal**: View detailed metadata for each route by clicking on the route polyline.
- **Error Handling**: Displays error messages for invalid or unsupported files.
- **Clear Functionality**: Clear loaded routes without reloading the Google Maps runtime.

## Technologies Used

- **Angular**: Standalone component architecture.
- **Google Maps JavaScript API**: For map rendering and route visualization.
- **Angular Material**: Progress bar for file parsing progress.
- **Bootstrap Modals**: For displaying input and route detail modals.
- **TypeScript**: Strongly typed language for better maintainability.

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/creightonlinza/fit-routes-mapper.git
   cd fit-routes-mapper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a local runtime config and add your Google Maps API key:
   ```bash
   cp public/app-config.example.json public/app-config.json
   ```

   Update `public/app-config.json` with your key. This file is ignored by Git. The tracked `src/environments/environment.ts` file contains source-safe defaults only.

4. Run the application:
   ```bash
   ng serve
   ```

5. Open your browser and navigate to `http://localhost:4200`.

## How to Use

1. **Upload Files**:
   - Drag and drop `.fit` files into the app, or click the file input button to select files manually.

2. **Parse Files**:
   - The app will parse the uploaded `.fit` files and display the routes on the map.

3. **Interact with Routes**:
   - Click on a route polyline to view detailed metadata in a modal.
   - Use the route drawer to hide, zoom to, inspect, or delete individual routes.

4. **Customize Options**:
   - Toggle activity types (e.g., cycling, running) to filter the parsed data.
   - Choose units and route color mode before loading files.
   - Adjust map type, route width, and route opacity after loading.

5. **Export Visible Routes**:
   - Use the GeoJSON or CSV buttons to export only the routes currently visible on the map.

6. **Clear the App**:
   - Click the clear button to remove loaded routes and start a new import.
