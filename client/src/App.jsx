import React from 'react'
import Login from "./pages/Login";
import Home from './pages/Home';
// import Register from "./pages/Register";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
const App = () => {
  return (
 <>
      <BrowserRouter>
        <Toaster />
        {/* <Header /> */}
        <Routes>
          <Route path="/" element={<Home />} />
          {/* <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} /> */}
          <Route path="/login" element={<Login />} />
          {/* <Route path="/register" element={<Register />} /> */}
          {/* <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/rider-dashboard" element={<RiderDashboard />} />
          <Route
            path="/restaurant-dashboard"
            element={<RestaurantDashboard />}
          />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/order-now" element={<OrderNow />} />
     <Route path="/restaurantMenu" element={<RestaurantDisplayMenu />} />
          <Route path="/checkout-page" element={<CheckoutPage />} />
          <Route path="*" element={<NotFound />} /> */}
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App