import React from 'react'
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
const Home = () => {
    const navigate = useNavigate();
  return (
    <div>
 <Link
            to={"/"}
            className="text-decoration-none text-(--color-text) hover:text-(--color-accent) font-semibold"
          >
            Home
          </Link>
          <button
                onClick={() => navigate("/login")}
                className="bg-(--color-secondary) text-(--color-text) py-2 px-4 font-bold hover:bg-(--color-secondary-hover) hover:text-white rounded "
              >
                Login
              </button>

    </div>
  )
}

export default Home