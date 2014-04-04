'use strict';

/* Controllers */

angular.module('myApp.controllers', [])
   .controller('HomeCtrl', ['$scope', 'syncData', function($scope, syncData) {
      syncData('syncedValue').$bind($scope, 'syncedValue');
   }])

      // 2-way synchronize of the articles this user has marked as read
      $scope.readArticles = syncData(['user', pid, uid, 'read'], 250);

      $scope.addFeed = function(feedId) {
         feedMgr.addFeed(feedId, function(errCode, errMsg) {
            $location.search('feed', feedId);
            $scope.startLoading();
            $scope.articles.$on('change', function() { $scope.stopLoading(); });
         });
      };

      $scope.removeFeed = function(feedId, $event) {
         $dialog.dialog({
            backdrop: true,
            keyboard: true,
            backdropClick: true,
            templateUrl: 'partials/confirmDialog.html',
            controller: 'ConfirmDialogCtrl'
         }).open().then(function(confirmed) {
            if( confirmed ) {
               if( $scope.activeFeed === feedId ) {
                  $scope.activeFeed = null;
                  $location.replace();
                  $location.search('feed', null);
               }
               if( $event ) {
                  $event.preventDefault();
                  $event.stopPropagation();
               }
               feedMgr.removeFeed(feedId);
               $scope.readArticles.$remove(feedId);
            }
         });
      };
   }])


   .controller('ArticleCtrl', ['$scope', function($scope) {
      var ABSOLUTE_WIDTH = 850;

      $scope.opts = {
         dialogClass: 'modal article'
      };

      $scope.open = function(article) {
         if( !article ) { $scope.close(); }
         else {
            $scope.article = article;
            setNext(article);
            setPrev(article);
            $scope.isOpen = true;
            resize();
            if( angular.element(window).width() <= ABSOLUTE_WIDTH ) {
               window.scrollTo(0,0);
            }
            $scope.markArticleRead(article);
         }
      };

      $scope.close = function() {
         $scope.isOpen = false;
      };

      $scope.closed = function() {
         $scope.article = null;
         $scope.isOpen = false;
      };

      // resize height of element dynamically
      var resize = _.debounce(function() {
         if( $scope.isOpen ) {
            var $article = angular.element('div.modal.article');
            var maxHeight = 'none';
            if( angular.element(window).width() > ABSOLUTE_WIDTH ) {
               var windowHeight = angular.element(window).height();
               var headHeight = $article.find('.modal-header').outerHeight() + $article.find('.modal-footer').outerHeight();
               maxHeight = (windowHeight * .8 - headHeight)+'px';
            }
            $article.find('.modal-body').css('max-height', maxHeight);
         }
      }, 50);

      function setNext(article) {
         var next = angular.element('#'+article.$id).next('article');
         $scope.next = next.length? $scope.articles.find(next.attr('id')) : null;
      }

      function setPrev(article) {
         var prev = angular.element('#'+article.$id).prev('article');
         $scope.prev = prev.length? $scope.articles.find(prev.attr('id')) : null;
      }

      angular.element(window).bind('resize', resize);

      $scope.$on('modal:article', function(event, article) {
         $scope.open(article);
      });

   }])

   .controller('CustomFeedCtrl', ['$scope', function($scope) {
      var $log = $scope.$log;
      $scope.isOpen = false;

      $scope.$on('modal:customFeed', function() {
         $scope.open();
      });

      $scope.open = function() {
         $scope.isOpen = true;
      };

      $scope.close = function() {
         $scope.isOpen = false;
      };

      $scope.add = function() {
         $log.debug('adding custom feed', $scope.title, $scope.url);
         $scope.feedManager.addFeed({url: $scope.url, title: $scope.title});
         $scope.close();
         $scope.title = null;
         $scope.url = null;
      };
   }])

  .controller('ChatCtrl', ['$scope', 'syncData', function($scope, syncData) {
      $scope.newMessage = null;

      // constrain number of messages by limit into syncData
      // add the array into $scope.messages
      $scope.messages = syncData('messages', 10);

      // add new messages to the list
      $scope.addMessage = function() {
         if( $scope.newMessage ) {
            $scope.messages.$add({text: $scope.newMessage});
            $scope.newMessage = null;
         }
      };
   }])

   .controller('LoginCtrl', ['$scope', 'loginService', '$location', function($scope, loginService, $location) {
      $scope.email = null;
      $scope.pass = null;
      $scope.confirm = null;
      $scope.createMode = false;

      $scope.login = function(cb) {
         $scope.err = null;
         if( !$scope.email ) {
            $scope.err = 'Please enter an email address';
         }
         else if( !$scope.pass ) {
            $scope.err = 'Please enter a password';
         }
         else {
            loginService.login($scope.email, $scope.pass, function(err, user) {
               $scope.err = err? err + '' : null;
               if( !err ) {
                  cb && cb(user);
               }
            });
         }
      };

      $scope.createAccount = function() {
         $scope.err = null;
         if( assertValidLoginAttempt() ) {
            loginService.createAccount($scope.email, $scope.pass, function(err, user) {
               if( err ) {
                  $scope.err = err? err + '' : null;
               }
               else {
                  // must be logged in before I can write to my profile
                  $scope.login(function() {
                     loginService.createProfile(user.uid, user.email);
                     $location.path('/account');
                  });
               }
            });
         }
      };

      function assertValidLoginAttempt() {
         if( !$scope.email ) {
            $scope.err = 'Please enter an email address';
         }
         else if( !$scope.pass ) {
            $scope.err = 'Please enter a password';
         }
         else if( $scope.pass !== $scope.confirm ) {
            $scope.err = 'Passwords do not match';
         }
         return !$scope.err;
      }
   }])

   .controller('AccountCtrl', ['$scope', 'loginService', 'changeEmailService', 'firebaseRef', 'syncData', '$location', 'FBURL', function($scope, loginService, changeEmailService, firebaseRef, syncData, $location, FBURL) {
      $scope.syncAccount = function() {
         $scope.user = {};
         syncData(['users', $scope.auth.user.uid]).$bind($scope, 'user').then(function(unBind) {
            $scope.unBindAccount = unBind;
         });
      };
      // set initial binding
      $scope.syncAccount();

      $scope.logout = function() {
         loginService.logout();
      };

      $scope.oldpass = null;
      $scope.newpass = null;
      $scope.confirm = null;

      $scope.reset = function() {
         $scope.err = null;
         $scope.msg = null;
         $scope.emailerr = null;
         $scope.emailmsg = null;
      };

      $scope.updatePassword = function() {
         $scope.reset();
         loginService.changePassword(buildPwdParms());
      };

      $scope.updateEmail = function() {
        $scope.reset();
        // disable bind to prevent junk data being left in firebase
        $scope.unBindAccount();
        changeEmailService(buildEmailParms());
      };

      function buildPwdParms() {
         return {
            email: $scope.auth.user.email,
            oldpass: $scope.oldpass,
            newpass: $scope.newpass,
            confirm: $scope.confirm,
            callback: function(err) {
               if( err ) {
                  $scope.err = err;
               }
               else {
                  $scope.oldpass = null;
                  $scope.newpass = null;
                  $scope.confirm = null;
                  $scope.msg = 'Password updated!';
               }
            }
         };
      }
      function buildEmailParms() {
         return {
            newEmail: $scope.newemail,
            pass: $scope.pass,
            callback: function(err) {
               if( err ) {
                  $scope.emailerr = err;
                  // reinstate binding
                  $scope.syncAccount();
               }
               else {
                  // reinstate binding
                  $scope.syncAccount();
                  $scope.newemail = null;
                  $scope.pass = null;
                  $scope.emailmsg = 'Email updated!';
               }
            }
         };
      }

   }]);