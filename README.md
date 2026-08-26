# 3D Furniture Configurator System

A web-based 3D furniture configuration system developed as a final year project. The system allows customers to browse furniture products, configure a virtual room with 3D furniture models, manage a shopping cart, place orders, and interact with an admin-managed furniture catalog.

## Features

- Customer registration, login, logout, and password reset
- Product browsing with furniture categories and product details
- Shopping cart management and checkout flow
- 3D room configuration using draggable furniture models
- Custom room size setup with save and load room functions
- 3D model interaction using camera controls and object transform controls
- Customer profile, order history, store location, about us, and contact/feedback pages
- Admin login with dashboard, product management, order management, and customer feedback management
- Supabase database integration for authentication, product data, cart, room, order, and feedback records

## Technologies Used

- HTML
- CSS
- JavaScript
- Three.js
- Supabase
- GLTF 3D models

## Project Structure

```text
3D Furniture Configurator System/
|-- SOURCE CODE/
|   |-- FINAL CODE/
|   |   |-- CUSTOMER/      # Customer pages, styling, and JavaScript modules
|   |   |-- ADMIN/         # Admin pages, styling, and JavaScript modules
|   |   `-- SUPABASE/      # Supabase connection files
|   `-- TEMPLATE/          # Template files
|-- MODEL ASSET/           # Furniture 3D model assets
|-- USED PICTURE/          # Product, store, and website images
`-- README.md
```

## Main Modules

### Customer Module

- Register and login using Supabase Authentication
- Browse furniture products and product details
- Add products to cart
- Place and view orders
- Create, save, and reload 3D room configurations
- Submit feedback or contact messages

### Admin Module

- Admin authentication and role checking
- Dashboard overview
- Product management
- Order management
- Customer feedback management

### 3D Room Configurator

The 3D configuration module uses Three.js to load and display GLTF furniture models. Users can add furniture into a virtual room, move selected items, adjust the room layout, save room data to Supabase, reload saved rooms, and add configured furniture items to the shopping cart.

## How to Run

1. Open the project folder:

```text
SOURCE CODE/FINAL CODE
```

2. Run the website using a local server, such as the Live Server extension in Visual Studio Code.
3. Open the customer or admin HTML pages in the browser:

```text
CUSTOMER/HTML/cus_login.html
ADMIN/HTML/admin_login.html
```

4. Make sure the Supabase connection files are configured correctly:

```text
SUPABASE/supabase_customer_conn.js
SUPABASE/supabase_admin_conn.js
```

## Academic Context

This project was developed as a final year project to explore interactive e-commerce features, 3D product visualization, room configuration, and cloud database integration for a furniture shopping platform.
