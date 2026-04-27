const Header = () => {
  return (
    <header className="text-center space-y-2 py-6">
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        MTR Fare <span className="text-green-600">Optimizer</span>
      </h1>
      <p className="text-lg text-gray-600 font-medium italic">
        "Extreme Edition: Because why pay full price when you can walk through a gate?"
      </p>
      <div className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wider">
        HCI Project • Money Saving Hack
      </div>
    </header>
  )
}

export default Header
