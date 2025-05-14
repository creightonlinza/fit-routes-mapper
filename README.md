# Fit Routes Mapper

The **Fit Routes Mapper** is an Angular standalone application designed to parse `.fit` files (commonly used in fitness tracking devices) and display the routes on a Google Map. The app allows users to upload `.fit` files, visualize parsed routes, and interact with route details.

## Features

- **Drag-and-Drop File Upload**: Easily upload `.fit` files by dragging and dropping them into the app.
- **Google Maps Integration**: Visualize routes on an interactive Google Map.
- **Route Parsing**: Parse `.fit` files to extract route data and display it with customizable options.
- **Activity Filtering**: Select specific activities (e.g., cycling, running) to include in the parsed data.
- **Randomized Route Colors**: Option to randomize route colors for better visualization.
- **Progress Tracking**: Displays a progress bar while parsing files.
- **Route Details Modal**: View detailed metadata for each route by clicking on the route polyline.
- **Error Handling**: Displays error messages for invalid or unsupported files.
- **Reset Functionality**: Quickly reset the app to its initial state.

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

3. Add your Google Maps API key to up the environment variables:
   - `environment.ts` file in the environments folder.
   - Default map settings can be customized there as well.

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

4. **Customize Options**:
   - Toggle activity types (e.g., cycling, running) to filter the parsed data.
   - Enable or disable random route colors.

5. **Reset the App**:
   - Click the reset button to reload the app and clear all data.
