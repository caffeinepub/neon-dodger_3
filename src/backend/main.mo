import Runtime "mo:core/Runtime";

actor {
  var highScore = 0;

  public shared ({ caller }) func submitScore(newScore : Nat) : async () {
    if (newScore > highScore) {
      highScore := newScore;
    } else {
      Runtime.trap("Score not high enough to update the high score");
    };
  };

  public query ({ caller }) func getHighScore() : async Nat {
    highScore;
  };
};
