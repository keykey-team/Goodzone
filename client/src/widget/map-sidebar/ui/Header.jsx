const Header = ({logoImg, isAdmin}) => {
  return (
    <div className="gz-side-header">
      <img src={logoImg} alt="logo" />
      <div>
        <div className="gz-logo-sub">
          {isAdmin ? "Адмін панель" : ""}
        </div>
      </div>
    </div>
  );
};

export default Header;
