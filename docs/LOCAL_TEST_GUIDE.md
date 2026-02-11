# React Gantt Local Testing Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5173`

### 3. Access the Demo

Open your browser and navigate to:

```
http://localhost:5173
```

## Configuring a Data Source

### Method 1: Through the UI (Recommended)

1. Open the application in your browser
2. Click the **+ Add** button
3. Fill in the configuration form:

   **Example Configuration:**
   - Configuration Name: `My Project`
   - Data Source URL: `https://your-api-domain.com`
   - Access Token: Your personal access token
   - Type: `project`
   - Project ID: Your project ID (e.g., `12345` or `namespace/project-name`)

4. Click **Test Connection** to verify connectivity
5. Once the test succeeds, click **Save**
6. The system will automatically load issues from the data source

### Method 2: Using Environment Variables (Optional)

Create a `.env.local` file (not tracked by git):

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your configuration:

```env
VITE_DATA_SOURCE_URL=https://your-api-domain.com
VITE_DATA_SOURCE_TOKEN=your-access-token
VITE_DATA_SOURCE_PROJECT_ID=12345
```

## Getting an Access Token

### 1. Log in to Your Data Source

Visit your data source instance.

### 2. Navigate to Access Tokens

- Go to your profile settings
- Look for **Access Tokens** or **Personal Access Tokens**

### 3. Create a New Token

- Token name: `Gantt Chart Integration`
- Expiration date: Set an expiration date (recommended)
- Scopes: Select **api** (full API access)
- Click **Create**

### 4. Copy the Token

**Important**: The token is only displayed once. Copy it immediately!

## Feature Test Checklist

### Basic Features

- [ ] Add a data source configuration
- [ ] Test connection succeeds
- [ ] Issues load successfully
- [ ] Milestones display as groupings
- [ ] View task details

### Sync Features

- [ ] Click "Sync" button for manual sync
- [ ] Check last sync time
- [ ] Edit task title and sync back
- [ ] Edit task dates and sync back
- [ ] Edit task progress

### Filter Features

- [ ] Click "Filters" to expand the filter panel
- [ ] Filter by milestone
- [ ] Filter by label
- [ ] Filter by assignee
- [ ] Filter by state (open/closed)
- [ ] Use the search box to find tasks

### Multi-Project Management

- [ ] Add a second data source configuration
- [ ] Switch projects in the dropdown
- [ ] Edit an existing configuration
- [ ] Delete a configuration

### Error Handling

- [ ] Test with an invalid token (should show error)
- [ ] Test with an invalid project ID (should show error)
- [ ] Behavior when network is disconnected

## Common Troubleshooting

### Q: Startup error "Cannot find module"

**A**: Make sure all dependencies are installed:

```bash
npm install
```

### Q: Token authentication fails

**A**: Check:

1. Token is copied correctly (no extra spaces)
2. Token has the `api` scope
3. Token has not expired
4. Data source URL is correct (includes https://)

### Q: Project ID not found

**A**: How to find your project ID:

1. Go to your project page in the data source
2. Look for the "Project ID" below the project name
3. Or use the URL path: `namespace/project-name`

### Q: Cannot sync issues back to the data source

**A**: Check:

1. Token permissions (may need Maintainer+ role)
2. Project is not read-only
3. Check the browser console for error messages

### Q: CORS error

**A**:

- In development mode, the Vite proxy handles CORS automatically
- For production deployments, see the [Deployment Guide](./DEPLOYMENT.md)

## Hot Reload in Development Mode

After modifying any file, Vite will automatically reload:

- Component files under `src/`
- Test files under `demos/`
- CSS styles

No need to restart the server.

## Browser Console

Press F12 to open developer tools to see:

- API requests
- Sync operation logs
- Error messages (if any)

## Other Demo Pages

The project includes 76+ example pages, browse from the left sidebar:

- Basic Gantt: `/base/willow`
- Backend data: `/backend/willow`
- Toolbar: `/toolbar/willow`

## Production Build Test

```bash
# Build the project
npm run build

# Preview the build result
npm run preview
```

## Need Help?

1. Check the deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Check the testing guide: [TESTING.md](./TESTING.md)
3. Check react-gantt documentation: https://docs.svar.dev/gantt/

## Test Data Persistence

Configuration data is stored in browser localStorage:

- Key: `gantt_configs`
- Clear test data: Run `localStorage.clear()` in the browser console
